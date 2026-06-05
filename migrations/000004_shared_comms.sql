-- ============================================================
-- MIGRATION 000004 — Shared comms tables
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- documents, document_tags, email_signatures,
-- message_channels, channel_members, messages, message_reads,
-- message_attachments,
-- notifications, notification_preferences
-- ============================================================

-- ── documents ────────────────────────────────────────────
-- Tamper-proof file archive.
-- After creation: only is_deleted and deleted_at can change
-- (enforced by trigger trg_documents_immutable in 000013).
CREATE TABLE shared.documents (
  document_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number       TEXT        NOT NULL UNIQUE,           -- from document_numbering
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE RESTRICT,
  document_type         TEXT        NOT NULL,
  -- Types: invoice | purchase_order | quotation | contract | certificate
  --        delivery_note | payslip | receipt | settlement | report
  --        stylist_certificate | stylist_payout_remittance
  --        production_summary | intercompany_invoice | other
  title                 TEXT        NOT NULL,
  file_path             TEXT        NOT NULL,                  -- relative storage path or S3 key
  file_size_bytes       INTEGER     NOT NULL,
  mime_type             TEXT        NOT NULL DEFAULT 'application/pdf',
  content_hash          TEXT        NOT NULL,                  -- SHA-256 of file at upload
  -- The record this document attaches to. reference_id is NOT a FK
  -- because the target may live in any brand schema.
  reference_type        TEXT,
  reference_id          UUID,
  uploaded_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  is_deleted            BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
-- NOTE: No updated_at — immutable after creation except soft-delete fields.
CREATE INDEX idx_documents_reference  ON shared.documents (reference_type, reference_id);
CREATE INDEX idx_documents_business   ON shared.documents (business, document_type);
CREATE INDEX idx_documents_number     ON shared.documents (document_number);
CREATE INDEX idx_documents_hash       ON shared.documents (content_hash);

-- Now wire the deferred FK on staff_contracts → documents
ALTER TABLE shared.staff_contracts
  ADD CONSTRAINT fk_staff_contracts_document
    FOREIGN KEY (document_id) REFERENCES shared.documents (document_id) ON DELETE SET NULL;

-- ── document_tags ────────────────────────────────────────
CREATE TABLE shared.document_tags (
  tag_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID        NOT NULL REFERENCES shared.documents (document_id) ON DELETE CASCADE,
  tag_name              TEXT        NOT NULL,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  colour                TEXT        DEFAULT '#64748B',
  tagged_by             UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, tag_name, business)
);
CREATE INDEX idx_document_tags_document ON shared.document_tags (document_id);
CREATE INDEX idx_document_tags_name     ON shared.document_tags (business, tag_name);

-- ── email_signatures ─────────────────────────────────────
-- Per-user, per-brand HTML signature appended to outbound mail.
CREATE TABLE shared.email_signatures (
  signature_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  full_name             TEXT        NOT NULL,
  job_title             TEXT        NOT NULL,
  phone                 TEXT,
  html_content          TEXT        NOT NULL,
  template_version      INTEGER     NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, business)
);
CREATE TRIGGER trg_email_signatures_updated_at
  BEFORE UPDATE ON shared.email_signatures
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ SMARTCOMM — UNIFIED INBOX (Module 6.17)                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── message_channels ─────────────────────────────────────
-- A channel = a conversation thread. Group / direct / customer_thread.
-- For customer threads we record which external channel the
-- conversation originated on (Instagram DM, WhatsApp, website chat).
CREATE TABLE shared.message_channels (
  channel_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_type          TEXT        NOT NULL
                        CHECK (channel_type IN ('group','direct','customer_thread')),
  name                  TEXT,                                  -- NULL for direct messages
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- For customer_thread channels: the external platform
  external_platform     TEXT        CHECK (external_platform IN
                        ('instagram','whatsapp','facebook','website_chat','email',NULL)),
  external_thread_ref   TEXT,                                  -- Instagram conversation ID etc.
  is_archived           BOOLEAN     NOT NULL DEFAULT false,
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_message_channels_updated_at
  BEFORE UPDATE ON shared.message_channels
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_message_channels_business ON shared.message_channels (business);
CREATE INDEX idx_message_channels_external ON shared.message_channels (external_platform, external_thread_ref)
  WHERE external_thread_ref IS NOT NULL;

-- ── channel_members ──────────────────────────────────────
CREATE TABLE shared.channel_members (
  member_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            UUID        NOT NULL REFERENCES shared.message_channels (channel_id) ON DELETE CASCADE,
  user_id               UUID        REFERENCES shared.users (user_id) ON DELETE CASCADE,
  contact_id            UUID        REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  role                  TEXT        NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at          TIMESTAMPTZ,
  CONSTRAINT member_user_or_contact CHECK (
    (user_id IS NOT NULL AND contact_id IS NULL) OR
    (user_id IS NULL AND contact_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX idx_channel_members_unique_user
  ON shared.channel_members (channel_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_channel_members_unique_contact
  ON shared.channel_members (channel_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_channel_members_user    ON shared.channel_members (user_id)    WHERE user_id IS NOT NULL;
CREATE INDEX idx_channel_members_contact ON shared.channel_members (contact_id) WHERE contact_id IS NOT NULL;

-- ── messages ─────────────────────────────────────────────
CREATE TABLE shared.messages (
  message_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id            UUID        NOT NULL REFERENCES shared.message_channels (channel_id) ON DELETE CASCADE,
  sender_user_id        UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  sender_contact_id     UUID        REFERENCES shared.contacts (contact_id) ON DELETE SET NULL,
  message_type          TEXT        NOT NULL DEFAULT 'text'
                        CHECK (message_type IN ('text','image','document','voice_note','video','sticker','system')),
  content               TEXT,
  reply_to_id           UUID        REFERENCES shared.messages (message_id) ON DELETE SET NULL,
  is_deleted            BOOLEAN     NOT NULL DEFAULT false,
  external_ref          TEXT,                                  -- WhatsApp/Instagram message ID if bridged
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT message_sender_check CHECK (
    (sender_user_id IS NOT NULL AND sender_contact_id IS NULL) OR
    (sender_user_id IS NULL AND sender_contact_id IS NOT NULL) OR
    (sender_user_id IS NULL AND sender_contact_id IS NULL AND message_type = 'system')
  )
);
CREATE INDEX idx_messages_channel_time ON shared.messages (channel_id, created_at DESC);
CREATE INDEX idx_messages_external_ref ON shared.messages (external_ref) WHERE external_ref IS NOT NULL;

-- ── message_reads ────────────────────────────────────────
CREATE TABLE shared.message_reads (
  message_id            UUID        NOT NULL REFERENCES shared.messages (message_id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  read_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_message_reads_user ON shared.message_reads (user_id);

-- ── message_attachments ──────────────────────────────────
CREATE TABLE shared.message_attachments (
  attachment_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id            UUID        NOT NULL REFERENCES shared.messages (message_id) ON DELETE CASCADE,
  document_id           UUID        NOT NULL REFERENCES shared.documents (document_id),
  display_name          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_msg_attachments_message ON shared.message_attachments (message_id);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ NOTIFICATIONS                                                      ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── notifications ────────────────────────────────────────
CREATE TABLE shared.notifications (
  notification_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  type                  TEXT        NOT NULL,
  -- Types: stock_alert | payment_due | approval_required | delivery_update
  --        task_due | message | system | discount_approval | leave_request
  --        production_state_change | stylist_offer | stylist_assignment_accepted
  --        subscription_billing_failed | intercompany_reconciliation_alert
  --        order_status_change | low_stock_warning | sale_campaign_milestone
  priority              TEXT        NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low','normal','high','urgent')),
  title                 TEXT        NOT NULL,
  body                  TEXT,
  reference_type        TEXT,
  reference_id          UUID,
  action_url            TEXT,
  is_read               BOOLEAN     NOT NULL DEFAULT false,
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON shared.notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_reference   ON shared.notifications (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ── notification_preferences ─────────────────────────────
CREATE TABLE shared.notification_preferences (
  pref_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  notification_type     TEXT        NOT NULL,
  in_app                BOOLEAN     NOT NULL DEFAULT true,
  email_enabled         BOOLEAN     NOT NULL DEFAULT true,
  whatsapp_enabled      BOOLEAN     NOT NULL DEFAULT false,
  sms_enabled           BOOLEAN     NOT NULL DEFAULT false,
  push_enabled          BOOLEAN     NOT NULL DEFAULT true,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type)
);
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON shared.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ============================================================
-- Verify
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'shared' AND table_name LIKE '%message%'
--    OR table_name IN ('documents','document_tags','email_signatures',
--                       'notifications','notification_preferences')
-- ORDER BY table_name;
-- ============================================================
