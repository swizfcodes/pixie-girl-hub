-- ============================================================
-- MIGRATION 000012 — Praxis AI Agent, Insights, Control & Governance
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- Three modules from the V2 product description:
--
--   6.29 Praxis AI Agent       — conversational agent (text + voice).
--                                Multi-agent: Orchestrator, Action,
--                                Query, Drafting. Grounded by the
--                                Action Catalogue (no hallucinated
--                                capabilities). EVERY WRITE requires
--                                explicit human confirmation —
--                                modelled as ai_pending_actions
--                                that the user confirms via UI.
--
--   6.30 AI Insights           — TWO-TIER design:
--                                Tier 1 (deterministic rules, no AI
--                                cost) → separate concrete tables
--                                per insight category for clean
--                                queries: stock alerts, margin
--                                breaches, overdue invoices,
--                                intercompany discrepancies,
--                                attendance anomalies, approval
--                                queue alerts.
--                                Tier 2 (AI narration over Tier-1
--                                summaries) → daily Praxis briefing.
--
--   6.31 AI Control            — feature flags, monthly caps,
--                                per-call usage ledger plus daily
--                                roll-up for the live spend meter.
--
-- All tables live in `shared`. Per-brand context is via business
-- column, never via per-brand schemas (AI is a system-level concern).
-- ============================================================

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 6.31  AI CONTROL & GOVERNANCE                                      ║
-- ║       (defined first because Praxis & Insights reference it)       ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── ai_feature_flags ─────────────────────────────────────
-- The CEO toggles individual AI capabilities on/off. The application
-- consults this on every AI call; if disabled, the call short-circuits
-- (with a clear message in the UI).
CREATE TABLE shared.ai_feature_flags (
  flag_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key           TEXT        NOT NULL UNIQUE,
  -- Keys: 'praxis_chat','praxis_voice','praxis_drafting','praxis_web_prefill',
  --       'insights_briefing','insights_briefing_realtime',
  --       'insights_weekly_report',
  --       'insights_stock','insights_margin','insights_invoice',
  --       'insights_intercompany','insights_attendance','insights_approval',
  --       'insights_service_match',
  --       'embeddings'
  display_name          TEXT        NOT NULL,
  description           TEXT,
  is_enabled            BOOLEAN     NOT NULL DEFAULT true,
  -- Default model for this feature (overridable per call)
  default_provider      TEXT        NOT NULL DEFAULT 'deepseek',
  default_model         TEXT        NOT NULL DEFAULT 'deepseek-chat',
  -- Estimated cost per call in NGN (for soft caps; refined by usage)
  est_cost_per_call_ngn NUMERIC(10,4),
  last_changed_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  last_changed_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_feature_flags_updated_at
  BEFORE UPDATE ON shared.ai_feature_flags
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ── ai_access_grants ─────────────────────────────────────
-- Which users may use which AI features. V1 of Praxis is CEO-only;
-- the CEO grants additional access as the AI budget allows.
CREATE TABLE shared.ai_access_grants (
  grant_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  feature_key           TEXT        NOT NULL REFERENCES shared.ai_feature_flags (feature_key) ON DELETE CASCADE,
  -- Optional per-user cap (NULL = no extra cap on top of global)
  monthly_cap_ngn       NUMERIC(12,2),
  granted_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at            TIMESTAMPTZ,
  revoked_reason        TEXT,
  UNIQUE (user_id, feature_key)
);
CREATE INDEX idx_ai_access_active ON shared.ai_access_grants (user_id, feature_key)
  WHERE revoked_at IS NULL;

-- ── ai_vendor_credentials ────────────────────────────────
-- Multi-vendor API key management per V2.2 §8.1. Three vendors at
-- launch: DeepSeek (LLM), Groq (Whisper), OpenAI (embeddings). Keys
-- are stored AES-256 encrypted at the application layer — never in
-- plaintext, never exposed to the frontend, CEO-only access via
-- Module 18 (Business Setup).
CREATE TABLE shared.ai_vendor_credentials (
  credential_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor                TEXT        NOT NULL UNIQUE
                        CHECK (vendor IN ('deepseek','groq','openai','self_hosted','other')),
  display_name          TEXT        NOT NULL,                   -- 'DeepSeek API'
  -- Encrypted API key (AES-256 at app layer)
  api_key_enc           TEXT,
  -- Optional encrypted secrets (e.g. organisation ID)
  org_id_enc            TEXT,
  -- Endpoint override (e.g. for self-hosted)
  endpoint_url          TEXT,
  -- Default model for this vendor (override-able per-feature)
  default_model         TEXT,
  -- Per-call cost in vendor's native currency, used for usage_ledger
  -- cost calculations. Updated by an admin when pricing changes.
  cost_per_1k_input_tokens  NUMERIC(12,6) NOT NULL DEFAULT 0,
  cost_per_1k_output_tokens NUMERIC(12,6) NOT NULL DEFAULT 0,
  -- For Whisper-style transcription: cost per minute of audio
  cost_per_audio_minute     NUMERIC(12,6) NOT NULL DEFAULT 0,
  -- For embeddings: cost per 1k input tokens (output_tokens irrelevant)
  cost_native_currency  TEXT        REFERENCES shared.currencies (currency_code),
  -- Per-vendor monthly cap (additional to global ai_budget_periods).
  -- NULL = no per-vendor cap.
  per_vendor_monthly_cap_ngn NUMERIC(12,2),
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  last_rotated_at       TIMESTAMPTZ,
  last_rotated_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_vendor_credentials_updated_at
  BEFORE UPDATE ON shared.ai_vendor_credentials
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ── ai_budget_periods ────────────────────────────────────
-- Monthly budget windows. The Hub creates a row at the start of
-- each calendar month with the CEO's configured cap. Hard stop
-- triggers when actual_spend_ngn ≥ hard_cap_ngn.
CREATE TABLE shared.ai_budget_periods (
  period_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start          DATE        NOT NULL,
  period_end            DATE        NOT NULL,
  -- Caps in NGN
  soft_cap_ngn          NUMERIC(12,2) NOT NULL,                  -- warning at this level
  hard_cap_ngn          NUMERIC(12,2) NOT NULL,                  -- pause AI when reached
  -- Running totals (maintained by trigger on ai_usage_ledger)
  actual_spend_ngn      NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_calls_count    INTEGER     NOT NULL DEFAULT 0,
  -- Lifecycle
  soft_cap_breached_at  TIMESTAMPTZ,
  hard_cap_breached_at  TIMESTAMPTZ,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  set_by                UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_budget_dates_valid CHECK (period_end >= period_start),
  CONSTRAINT ai_budget_caps_valid  CHECK (hard_cap_ngn >= soft_cap_ngn)
);
CREATE TRIGGER trg_ai_budget_periods_updated_at
  BEFORE UPDATE ON shared.ai_budget_periods
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE UNIQUE INDEX idx_ai_budget_active_unique
  ON shared.ai_budget_periods (period_start) WHERE is_active = true;

-- ── ai_usage_ledger ──────────────────────────────────────
-- APPEND-ONLY per-call ledger. Every Praxis call, every Insights AI
-- narration writes one row here. Needed for the hard-cap enforcement
-- (provider returns tokens per call) and for the per-feature spend
-- breakdown on the live meter.
CREATE TABLE shared.ai_usage_ledger (
  usage_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who/what
  user_id               UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  feature_key           TEXT        NOT NULL REFERENCES shared.ai_feature_flags (feature_key) ON DELETE RESTRICT,
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE SET NULL,
  -- Linked conversation/run (NULL for fire-and-forget calls)
  conversation_id       UUID,                                    -- soft FK → ai_conversations (defined below)
  run_id                UUID,                                    -- soft FK → ai_run_steps
  -- Linked budget period (denormalised for fast SUM by period)
  period_id             UUID        REFERENCES shared.ai_budget_periods (period_id) ON DELETE SET NULL,
  -- The call
  -- vendor is the canonical key into ai_vendor_credentials.
  -- 'provider' was the legacy name; vendor is the V2.2 term but we
  -- keep the column name 'provider' to avoid breaking call sites.
  -- Values: 'deepseek','groq','openai','self_hosted','other'
  provider              TEXT        NOT NULL,
  model                 TEXT        NOT NULL,
  call_type             TEXT        NOT NULL
                        CHECK (call_type IN ('chat_completion','embedding','transcription',
                                             'draft_generation','insight_narration')),
  -- For transcription calls: audio seconds processed (drives cost
  -- when vendor bills per-minute, e.g. Groq Whisper).
  audio_seconds         INTEGER     NOT NULL DEFAULT 0,
  -- Token + cost capture
  input_tokens          INTEGER     NOT NULL DEFAULT 0,
  output_tokens         INTEGER     NOT NULL DEFAULT 0,
  total_tokens          INTEGER     NOT NULL DEFAULT 0,
  cost_native           NUMERIC(12,6) NOT NULL DEFAULT 0,        -- in provider's billing currency
  cost_native_currency  TEXT        REFERENCES shared.currencies (currency_code),
  cost_ngn              NUMERIC(12,4) NOT NULL DEFAULT 0,
  -- Latency (for ops dashboards)
  latency_ms            INTEGER,
  -- Result
  was_successful        BOOLEAN     NOT NULL DEFAULT true,
  error_code            TEXT,
  error_message         TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_user_time     ON shared.ai_usage_ledger (user_id, occurred_at DESC);
CREATE INDEX idx_ai_usage_feature_time  ON shared.ai_usage_ledger (feature_key, occurred_at DESC);
CREATE INDEX idx_ai_usage_period        ON shared.ai_usage_ledger (period_id) WHERE period_id IS NOT NULL;
CREATE INDEX idx_ai_usage_conversation  ON shared.ai_usage_ledger (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX idx_ai_usage_occurred      ON shared.ai_usage_ledger (occurred_at DESC);

-- ── ai_usage_daily ───────────────────────────────────────
-- Roll-up table for the live spend meter dashboard.
-- One row per (feature, vendor, user, date). Maintained by a
-- trigger on ai_usage_ledger (defined in 000014_shared_triggers.sql).
--
-- Note on cardinality: keying by vendor means the AI Control screen
-- can render "spend by feature" AND "spend by vendor" without any
-- per-call ledger scans.
CREATE TABLE shared.ai_usage_daily (
  daily_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date           DATE        NOT NULL,
  feature_key           TEXT        NOT NULL REFERENCES shared.ai_feature_flags (feature_key) ON DELETE CASCADE,
  vendor                TEXT        NOT NULL,                  -- 'deepseek','groq','openai',...
  user_id               UUID        REFERENCES shared.users (user_id) ON DELETE CASCADE,
  -- Totals for the day
  calls_count           INTEGER     NOT NULL DEFAULT 0,
  total_tokens          INTEGER     NOT NULL DEFAULT 0,
  input_tokens          INTEGER     NOT NULL DEFAULT 0,
  output_tokens         INTEGER     NOT NULL DEFAULT 0,
  audio_seconds         INTEGER     NOT NULL DEFAULT 0,
  cost_ngn              NUMERIC(14,4) NOT NULL DEFAULT 0,
  failed_calls_count    INTEGER     NOT NULL DEFAULT 0,
  refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (metric_date, feature_key, vendor, user_id)
);
CREATE INDEX idx_ai_usage_daily_date    ON shared.ai_usage_daily (metric_date DESC);
CREATE INDEX idx_ai_usage_daily_feature ON shared.ai_usage_daily (feature_key, metric_date DESC);
CREATE INDEX idx_ai_usage_daily_vendor  ON shared.ai_usage_daily (vendor, metric_date DESC);
CREATE INDEX idx_ai_usage_daily_user    ON shared.ai_usage_daily (user_id, metric_date DESC);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 6.29  PRAXIS AI AGENT                                              ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── ai_action_catalogue ──────────────────────────────────
-- The curated catalogue of actions Praxis can take. Generated from
-- the backend's OpenAPI spec by a build script, then reviewed/edited
-- by an admin. Praxis may ONLY choose entries that exist here AND
-- have ai_enabled = true. If a user intent has no match, Praxis says
-- so explicitly and offers to file a request with JBS Praxis — it
-- never invents capabilities.
--
-- Note on embeddings: this table does NOT carry a vector column.
-- Embeddings live in shared.ai_embeddings keyed by source_table +
-- source_id. This keeps the catalogue's core schema independent of
-- the chosen embedding model (see §8.1 of the V2 product description).
CREATE TABLE shared.ai_action_catalogue (
  action_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key            TEXT        NOT NULL UNIQUE,             -- 'invoicing.create_intercompany_invoice'
  title                 TEXT        NOT NULL,                    -- short display name
  -- HTTP details so the agent can invoke the real endpoint
  method                TEXT        NOT NULL CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  route                 TEXT        NOT NULL,                    -- '/api/invoicing/intercompany'
  -- Human-readable plain-language description (RAG anchor)
  description           TEXT        NOT NULL,
  -- Categorisation for the orchestrator
  module                TEXT        NOT NULL,                    -- maps to permissions.module
  category              TEXT        NOT NULL
                        CHECK (category IN ('read','write','draft','navigate')),
  -- Explicit write flag (mirrors category for fast filtering and
  -- matches the V2.2 spec's action-catalogue contract).
  is_write              BOOLEAN     NOT NULL DEFAULT false,
  -- Entity isolation: which entity (or both) this action applies to.
  -- The Action Agent rejects matches where the active conversation's
  -- business doesn't satisfy this scope.
  entity_scope          TEXT        NOT NULL DEFAULT 'both'
                        CHECK (entity_scope IN ('pxg','flh','both','any')),
  -- JSON schema describing the payload the route expects
  payload_schema        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Permission required for this action (matches permissions table)
  required_permission   TEXT        NOT NULL,                    -- e.g. 'invoicing.create'
  -- Whether Praxis is permitted to USE this action (admin gate)
  ai_enabled            BOOLEAN     NOT NULL DEFAULT false,
  -- Confidence floor — Praxis won't auto-pick this action unless
  -- the orchestrator's intent-match confidence is at least this high.
  -- If below, Praxis asks rather than guesses.
  min_confidence        NUMERIC(3,2) NOT NULL DEFAULT 0.80,
  -- Write actions require human confirmation. Reads bypass.
  -- (Computed = is_write by default, but admin may override e.g.
  -- to require confirmation on a sensitive read.)
  requires_confirmation BOOLEAN     NOT NULL DEFAULT true,
  -- Example utterances + payloads for the few-shot prompt.
  -- These are ALSO embedded (separately) so retrieval can match by
  -- "what users typically say" not only by description.
  examples              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_action_catalogue_updated_at
  BEFORE UPDATE ON shared.ai_action_catalogue
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_actions_module    ON shared.ai_action_catalogue (module, category)
  WHERE is_active = true AND ai_enabled = true;
CREATE INDEX idx_ai_actions_entity    ON shared.ai_action_catalogue (entity_scope)
  WHERE is_active = true AND ai_enabled = true;
CREATE INDEX idx_ai_actions_write     ON shared.ai_action_catalogue (is_write)
  WHERE is_active = true AND ai_enabled = true;

-- ── ai_knowledge_chunks ──────────────────────────────────
-- The RAG corpus: chunks of the Product Description, SOPs, training
-- material, and entity-context snippets.
--
-- Per V2.2 §8.4 ("permission-scoped retrieval"): every chunk carries
-- the access scope of its source. Retrieval filters by the CURRENT
-- user's permissions and active entity BEFORE similarity ranking.
-- Cost-price, salary, or other-entity content is never surfaced to
-- a user who cannot see it in the UI.
--
-- Note: the actual pgvector embedding does NOT live on this table —
-- it lives in shared.ai_embeddings keyed by ('ai_knowledge_chunks',
-- chunk_id). This isolates embedding-model migrations from the
-- knowledge schema (V2.2 §8.1 "Future-proofing the embeddings").
CREATE TABLE shared.ai_knowledge_chunks (
  chunk_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type           TEXT        NOT NULL
                        CHECK (source_type IN ('product_description','sop','training_material',
                                               'entity_context','schema_doc','action_catalogue',
                                               'action_example','custom')),
  source_ref            TEXT,                                    -- file path / section id
  -- Entity scope: NULL = applies to all brands. Drives entity-filtered retrieval.
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  title                 TEXT        NOT NULL,
  -- The SOURCE TEXT is retained alongside any future embedding —
  -- never just the vector. This is what makes re-embedding to a new
  -- model possible without re-ingesting source documents.
  content               TEXT        NOT NULL,
  token_count           INTEGER     NOT NULL,

  -- ─── ACCESS-SCOPE RBAC (V2.2 §8.4) ───────────────────────
  -- Required permission to surface this chunk in retrieval. Empty
  -- array = no restriction beyond the business filter. Example:
  -- a chunk about staff salaries would carry ['payroll.view'].
  required_permissions  TEXT[]      NOT NULL DEFAULT '{}',
  -- Sensitivity tag drives an extra filter for high-sensitivity
  -- content (cost prices, supplier origins, salaries, NIN/BVN).
  sensitivity           TEXT        NOT NULL DEFAULT 'normal'
                        CHECK (sensitivity IN ('public','normal','restricted','confidential','secret')),
  -- Hidden fields the chunk contains (for redaction during retrieval
  -- if the user can read the chunk but not those fields).
  contains_field_tags   TEXT[]      NOT NULL DEFAULT '{}',
  -- Free-form metadata
  metadata              JSONB       NOT NULL DEFAULT '{}'::jsonb,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  ingested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  -- Hash of the source text, used to detect content drift and to
  -- decide whether re-embedding is needed.
  content_hash          TEXT        NOT NULL
);
CREATE INDEX idx_ai_knowledge_source         ON shared.ai_knowledge_chunks (source_type) WHERE is_active = true;
CREATE INDEX idx_ai_knowledge_business       ON shared.ai_knowledge_chunks (business) WHERE business IS NOT NULL;
CREATE INDEX idx_ai_knowledge_sensitivity    ON shared.ai_knowledge_chunks (sensitivity) WHERE is_active = true;
CREATE INDEX idx_ai_knowledge_required_perms ON shared.ai_knowledge_chunks USING GIN (required_permissions);
CREATE INDEX idx_ai_knowledge_hash           ON shared.ai_knowledge_chunks (content_hash);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ DEDICATED EMBEDDINGS TABLE (V2.2 §8.1 "Future-proofing")           ║
-- ║                                                                    ║
-- ║ Embeddings live in their own table keyed by (source_table,         ║
-- ║ source_id). Every row records the embedding_model and version, so  ║
-- ║ two models can run side-by-side during a migration and stale       ║
-- ║ vectors are identifiable. Changing the embedding dimension does    ║
-- ║ NOT touch business tables.                                         ║
-- ╚════════════════════════════════════════════════════════════════════╝

CREATE TABLE shared.ai_embeddings (
  embedding_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- What this vector represents (denormalised soft reference because
  -- the source can be in shared OR in any business schema).
  source_table          TEXT        NOT NULL,
  -- Examples: 'ai_knowledge_chunks','ai_action_catalogue',
  --           'ai_action_examples','products','contacts'
  source_id             UUID        NOT NULL,
  -- For composite sources (e.g. a single example within a catalogue
  -- row), this disambiguates.
  source_sub_key        TEXT,
  -- Provenance: which model produced this vector
  embedding_model       TEXT        NOT NULL,                   -- 'text-embedding-3-small'
  embedding_version     SMALLINT    NOT NULL DEFAULT 1,         -- bump when model changes
  embedding_dim         SMALLINT    NOT NULL DEFAULT 1536,
  -- The retained SOURCE TEXT used to produce this vector. Means a
  -- re-embed never needs the original document — the text is here.
  source_text           TEXT        NOT NULL,
  source_text_hash      TEXT        NOT NULL,                   -- detect drift
  -- The vector itself. Fixed at 1536 for text-embedding-3-small.
  embedding             vector(1536) NOT NULL,
  -- Inherited scope filters (denormalised from the source) so a
  -- single similarity query can include the access checks WITHOUT
  -- joining back to the source table.
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  required_permissions  TEXT[]      NOT NULL DEFAULT '{}',
  sensitivity           TEXT        NOT NULL DEFAULT 'normal'
                        CHECK (sensitivity IN ('public','normal','restricted','confidential','secret')),
  -- Lifecycle
  is_stale              BOOLEAN     NOT NULL DEFAULT false,     -- set to true when source_text_hash drifts
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_by_id      UUID        REFERENCES shared.ai_embeddings (embedding_id) ON DELETE SET NULL,
  -- One active embedding per (source_table, source_id, sub_key, model, version)
  UNIQUE (source_table, source_id, source_sub_key, embedding_model, embedding_version)
);
CREATE INDEX idx_ai_embeddings_source         ON shared.ai_embeddings (source_table, source_id)
  WHERE is_active = true;
CREATE INDEX idx_ai_embeddings_business       ON shared.ai_embeddings (business)
  WHERE business IS NOT NULL AND is_active = true;
CREATE INDEX idx_ai_embeddings_required_perms ON shared.ai_embeddings USING GIN (required_permissions)
  WHERE is_active = true;
CREATE INDEX idx_ai_embeddings_sensitivity    ON shared.ai_embeddings (sensitivity)
  WHERE is_active = true;
CREATE INDEX idx_ai_embeddings_model          ON shared.ai_embeddings (embedding_model, embedding_version);
-- Approximate nearest-neighbour index for similarity search.
-- One index, all sources. Filters in the WHERE clause of the query
-- (business, required_permissions, sensitivity, source_table).
CREATE INDEX idx_ai_embeddings_vector
  ON shared.ai_embeddings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ── ai_conversations ─────────────────────────────────────
-- One row per user-Praxis chat thread. Persistent so the user can
-- resume later. Conversations are scoped to a single business at any
-- moment but can switch (the orchestrator carries business context
-- forward).
CREATE TABLE shared.ai_conversations (
  conversation_id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE SET NULL,
  title                 TEXT,                                    -- auto-generated from first message
  is_voice_started      BOOLEAN     NOT NULL DEFAULT false,
  -- For voice sessions: how many seconds of audio in total
  voice_seconds_used    INTEGER     NOT NULL DEFAULT 0,
  -- Token totals for this conversation (denormalised for quick UI)
  total_tokens          INTEGER     NOT NULL DEFAULT 0,
  total_cost_ngn        NUMERIC(12,4) NOT NULL DEFAULT 0,
  message_count         INTEGER     NOT NULL DEFAULT 0,
  -- Lifecycle
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_archived           BOOLEAN     NOT NULL DEFAULT false,
  archived_at           TIMESTAMPTZ
);
CREATE INDEX idx_ai_conversations_user ON shared.ai_conversations (user_id, last_activity_at DESC)
  WHERE is_archived = false;

-- ── ai_messages ──────────────────────────────────────────
-- The user-and-agent message exchange. Append-only.
CREATE TABLE shared.ai_messages (
  message_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID        NOT NULL REFERENCES shared.ai_conversations (conversation_id) ON DELETE CASCADE,
  role                  TEXT        NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  -- Source of the user message
  input_mode            TEXT        CHECK (input_mode IN ('text','voice')),
  -- For voice input: the transcribed text (Whisper) PLUS the source
  -- audio URL (kept in S3 for replay/dispute)
  transcribed_text      TEXT,
  source_audio_url      TEXT,
  -- The textual content
  content               TEXT        NOT NULL,
  -- If this assistant turn proposed an action, the proposed action is
  -- materialised as an ai_pending_action row (FK below).
  pending_action_id     UUID,                                    -- FK after ai_pending_actions
  -- Token usage attributable to this message
  input_tokens          INTEGER,
  output_tokens         INTEGER,
  -- The model that produced this assistant message
  provider              TEXT,
  model                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_messages_conversation ON shared.ai_messages (conversation_id, created_at);

-- ── ai_pending_actions ───────────────────────────────────
-- The strict safety gate from the V2 product description: Praxis
-- "reads freely; every action that changes data requires explicit
-- human confirmation, showing exactly what will happen." Each
-- proposed write becomes one row here in 'proposed' status, the UI
-- shows the user the rendered plan, the user confirms or rejects,
-- and only on confirmation does the application execute the
-- underlying action.
CREATE TABLE shared.ai_pending_actions (
  pending_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID        NOT NULL REFERENCES shared.ai_conversations (conversation_id) ON DELETE CASCADE,
  message_id            UUID        REFERENCES shared.ai_messages (message_id) ON DELETE SET NULL,
  proposed_by_user_id   UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE RESTRICT,
  -- The catalogue entry chosen
  action_id             UUID        NOT NULL REFERENCES shared.ai_action_catalogue (action_id) ON DELETE RESTRICT,
  action_key            TEXT        NOT NULL,                    -- denormalised for log readability
  -- Brand context for the action
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE SET NULL,
  -- The exact request the agent intends to send
  method                TEXT        NOT NULL,
  route                 TEXT        NOT NULL,
  payload               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- The plain-language summary shown to the user before they confirm
  -- (e.g. "I'll create a wholesale invoice for 10 bone-straight wigs
  --        from PXG to Faitlyn at ₦450,000 net.")
  human_summary         TEXT        NOT NULL,
  -- The orchestrator's confidence in this intent match
  confidence            NUMERIC(3,2) NOT NULL,
  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed','confirmed','rejected','executed','failed','expired','cancelled')),
  -- Auto-expire unconfirmed actions to prevent stale executions
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  -- The confirmation
  confirmed_by_user_id  UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  confirmed_at          TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  -- The execution
  executed_at           TIMESTAMPTZ,
  execution_result      JSONB,                                   -- response from the underlying API
  execution_error       TEXT,
  -- The audit_log entry written when the action executed
  audit_log_id          UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_pending_actions_updated_at
  BEFORE UPDATE ON shared.ai_pending_actions
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_pending_open
  ON shared.ai_pending_actions (proposed_by_user_id, status, expires_at)
  WHERE status = 'proposed';
CREATE INDEX idx_ai_pending_conversation
  ON shared.ai_pending_actions (conversation_id, created_at DESC);

-- Wire deferred FK on ai_messages → ai_pending_actions
ALTER TABLE shared.ai_messages
  ADD CONSTRAINT fk_ai_messages_pending_action
    FOREIGN KEY (pending_action_id) REFERENCES shared.ai_pending_actions (pending_id) ON DELETE SET NULL;

-- ── ai_run_steps ─────────────────────────────────────────
-- Sub-agent step trace within a single user request. Useful for
-- debugging "why did Praxis pick that?" and for the post-hoc audit
-- of multi-step requests.
CREATE TABLE shared.ai_run_steps (
  step_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id       UUID        NOT NULL REFERENCES shared.ai_conversations (conversation_id) ON DELETE CASCADE,
  message_id            UUID        REFERENCES shared.ai_messages (message_id) ON DELETE SET NULL,
  agent                 TEXT        NOT NULL
                        CHECK (agent IN ('orchestrator','action','query','drafting')),
  step_number           SMALLINT    NOT NULL,
  step_type             TEXT        NOT NULL
                        CHECK (step_type IN ('plan','retrieve','match_action','call_action',
                                             'call_model','draft','answer','clarify','escalate')),
  -- Free-form trace payload (the input + output of this step)
  input                 JSONB,
  output                JSONB,
  -- If this step matched a catalogue action
  matched_action_id     UUID        REFERENCES shared.ai_action_catalogue (action_id) ON DELETE SET NULL,
  -- Cost attribution
  tokens_used           INTEGER,
  cost_ngn              NUMERIC(12,4),
  duration_ms           INTEGER,
  status                TEXT        NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','failed','skipped')),
  error_message         TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_run_steps_conversation
  ON shared.ai_run_steps (conversation_id, occurred_at);
CREATE INDEX idx_ai_run_steps_action
  ON shared.ai_run_steps (matched_action_id) WHERE matched_action_id IS NOT NULL;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 6.30  AI INSIGHTS — TIER 1 (Deterministic, separate concrete       ║
-- ║       tables per insight category)                                 ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- A common index/query pattern across all insight tables:
--   "Show me OPEN insights for this business, newest first."
-- All categories share lifecycle columns (open / acknowledged /
-- resolved / dismissed). Each category has its own ID columns and
-- threshold context.

-- ── ai_insight_stock_alerts ──────────────────────────────
-- "Stock below reorder point" and "projected to run out at current
-- velocity". Generated by SQL rule jobs over per-brand stock.
CREATE TABLE shared.ai_insight_stock_alerts (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- Soft FKs into business schema
  product_id            UUID        NOT NULL,
  variant_id            UUID,
  stock_location_id     UUID,
  -- Numbers at detection time
  current_stock         INTEGER     NOT NULL,
  reorder_point         INTEGER     NOT NULL,
  daily_velocity        NUMERIC(10,4) NOT NULL DEFAULT 0,        -- units/day over last 30d
  projected_days_left   INTEGER,                                 -- NULL if velocity = 0
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  -- Suppression key — used by the rule job to avoid creating
  -- duplicate alerts for the same product+location until resolved.
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_stock_updated_at
  BEFORE UPDATE ON shared.ai_insight_stock_alerts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_stock_open
  ON shared.ai_insight_stock_alerts (business, severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_stock_suppression
  ON shared.ai_insight_stock_alerts (business, suppression_key)
  WHERE status = 'open';

-- ── ai_insight_margin_breaches ───────────────────────────
-- "Margin under floor" and "price published below minimum" — fed by
-- Pricing Engine (6.25) and Production (6.24) cost data.
CREATE TABLE shared.ai_insight_margin_breaches (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  breach_type           TEXT        NOT NULL
                        CHECK (breach_type IN ('margin_below_floor','price_below_cost','price_below_intercompany_min',
                                               'cost_spike','negative_margin')),
  -- What's affected
  product_id            UUID,
  variant_id            UUID,
  channel               TEXT,                                    -- 'storefront','pos','wholesale','intercompany'
  -- Numbers
  current_cost_ngn      NUMERIC(14,2),
  current_price_ngn     NUMERIC(14,2),
  current_margin_pct    NUMERIC(7,4),
  floor_margin_pct      NUMERIC(7,4),
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  -- Lifecycle (same shape as stock alerts)
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_margin_updated_at
  BEFORE UPDATE ON shared.ai_insight_margin_breaches
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_margin_open
  ON shared.ai_insight_margin_breaches (business, severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_margin_suppression
  ON shared.ai_insight_margin_breaches (business, suppression_key)
  WHERE status = 'open';

-- ── ai_insight_invoice_alerts ────────────────────────────
-- "Invoice overdue" and "cash position" notes. Fed by per-brand
-- invoices and journal_entries.
CREATE TABLE shared.ai_insight_invoice_alerts (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  alert_type            TEXT        NOT NULL
                        CHECK (alert_type IN ('overdue','overdue_long','large_unpaid','cash_low','collection_dropping')),
  -- Soft FK
  invoice_id            UUID,
  customer_contact_id   UUID        REFERENCES shared.contacts (contact_id) ON DELETE SET NULL,
  -- Amounts
  amount_ngn            NUMERIC(14,2),
  days_overdue          INTEGER,
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_invoice_updated_at
  BEFORE UPDATE ON shared.ai_insight_invoice_alerts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_invoice_open
  ON shared.ai_insight_invoice_alerts (business, severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_invoice_suppression
  ON shared.ai_insight_invoice_alerts (business, suppression_key)
  WHERE status = 'open';

-- ── ai_insight_intercompany_alerts ───────────────────────
-- "Intercompany transaction unmatched" — sourced from the nightly
-- reconciliation sweep in shared.intercompany_reconciliations.
CREATE TABLE shared.ai_insight_intercompany_alerts (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ic_transaction_id     UUID        REFERENCES shared.intercompany_transactions (ic_transaction_id) ON DELETE CASCADE,
  recon_id              UUID        REFERENCES shared.intercompany_reconciliations (recon_id) ON DELETE SET NULL,
  alert_type            TEXT        NOT NULL
                        CHECK (alert_type IN ('unmatched','amount_mismatch','currency_mismatch','status_mismatch',
                                              'pending_too_long','duplicate_match')),
  seller_brand          TEXT,
  buyer_brand           TEXT,
  amount_ngn            NUMERIC(14,2),
  age_days              INTEGER,
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_ic_updated_at
  BEFORE UPDATE ON shared.ai_insight_intercompany_alerts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_ic_open
  ON shared.ai_insight_intercompany_alerts (severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_ic_suppression
  ON shared.ai_insight_intercompany_alerts (suppression_key)
  WHERE status = 'open';

-- ── ai_insight_attendance_anomalies ──────────────────────
-- "Off-site clock-in" and "attendance gaps". Fed by
-- shared.staff_clock_events and shared.geofences (Module 6.11.1).
CREATE TABLE shared.ai_insight_attendance_anomalies (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  staff_profile_id      UUID        NOT NULL REFERENCES shared.staff_profiles (profile_id) ON DELETE CASCADE,
  anomaly_type          TEXT        NOT NULL
                        CHECK (anomaly_type IN ('off_site_clock_in','missed_clock_in','missed_clock_out',
                                                'late_arrival','early_departure','overtime','unusual_pattern')),
  -- Reference event
  clock_event_id        UUID        REFERENCES shared.staff_clock_events (event_id) ON DELETE SET NULL,
  anomaly_date          DATE        NOT NULL,
  distance_from_geofence_m NUMERIC(10,2),
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_attendance_updated_at
  BEFORE UPDATE ON shared.ai_insight_attendance_anomalies
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_attendance_open
  ON shared.ai_insight_attendance_anomalies (business, severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_attendance_suppression
  ON shared.ai_insight_attendance_anomalies (business, suppression_key)
  WHERE status = 'open';

-- ── ai_insight_approval_queue_alerts ─────────────────────
-- "Pending approvals piling up". Fed by shared.workflow_instances.
CREATE TABLE shared.ai_insight_approval_queue_alerts (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- The approver who has the backlog (NULL = whole-business alert)
  approver_user_id      UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  alert_type            TEXT        NOT NULL
                        CHECK (alert_type IN ('queue_growing','item_stale','urgent_pending','sla_breach')),
  pending_count         INTEGER     NOT NULL,
  oldest_age_hours      INTEGER     NOT NULL,
  -- Reference to a specific workflow instance if it's a single-item alert
  workflow_instance_id  UUID        REFERENCES shared.workflow_instances (instance_id) ON DELETE SET NULL,
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  resolved_reason       TEXT,
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_approval_updated_at
  BEFORE UPDATE ON shared.ai_insight_approval_queue_alerts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_approval_open
  ON shared.ai_insight_approval_queue_alerts (business, severity, detected_at DESC)
  WHERE status = 'open';
CREATE UNIQUE INDEX idx_ai_insight_approval_suppression
  ON shared.ai_insight_approval_queue_alerts (business, suppression_key)
  WHERE status = 'open';

-- ── ai_insight_service_match ─────────────────────────────
-- Anti-pocketing insight (V2.2 §6.24/§6.30). Flags Faitlyn
-- service jobs that completed with no matching recorded sale or
-- intercompany transaction. Pairs with feature flag
-- 'insights_service_match'. Note that the underlying detection
-- query lives in the AI Insights service; this table is the
-- materialised flag record so the CEO dashboard can list, ack,
-- and resolve. The 7th Tier-1 insight category — added in
-- Amendment-4 (CHANGELOG 2026-05-27) to fix the gap where the
-- feature flag pointed at no concrete table.
CREATE TABLE shared.ai_insight_service_match (
  insight_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- The flagged service job (soft FK because per-brand schema).
  -- Resolver service interprets via business + service_job_id.
  service_job_id        UUID        NOT NULL,
  service_job_number    TEXT,                                    -- denormalised for display
  -- Stylist or staff who completed the job (snapshot for audit)
  completed_by_stylist_id UUID      REFERENCES shared.stylist_partners (stylist_id) ON DELETE SET NULL,
  completed_by_user_id  UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  -- Why it was flagged
  alert_type            TEXT        NOT NULL
                        CHECK (alert_type IN (
                          'no_sale_linked',        -- service done, no sales_order linked
                          'no_payment_received',   -- linked sale has no payment
                          'no_intercompany_match', -- IC service has no IC transaction
                          'amount_mismatch'        -- linked sale amount != service cost
                        )),
  job_completed_at      TIMESTAMPTZ NOT NULL,
  -- Expected vs found
  expected_amount_ngn   NUMERIC(14,2),
  found_amount_ngn      NUMERIC(14,2),
  variance_ngn          NUMERIC(14,2),
  -- Lifecycle
  severity              TEXT        NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open','acknowledged','investigating','resolved','dismissed','escalated')),
  acknowledged_by       UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  -- Suppression
  suppression_key       TEXT        NOT NULL,
  detected_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_insight_service_match_updated_at
  BEFORE UPDATE ON shared.ai_insight_service_match
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_ai_insight_service_match_open
  ON shared.ai_insight_service_match (business, severity, detected_at DESC)
  WHERE status IN ('open','investigating');
CREATE INDEX idx_ai_insight_service_match_stylist
  ON shared.ai_insight_service_match (completed_by_stylist_id, detected_at DESC)
  WHERE completed_by_stylist_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ai_insight_service_match_suppression
  ON shared.ai_insight_service_match (business, suppression_key)
  WHERE status IN ('open','investigating');

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ 6.30  AI INSIGHTS — TIER 2 (AI narration over Tier-1 summaries)    ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── ai_briefings ─────────────────────────────────────────
-- The scheduled "Praxis Briefing" — short, plain-language narration
-- written by the AI from the summarised tier-1 insights. Generated
-- on a configurable schedule (real-time / daily / weekly / off) per
-- the AI Control settings.
CREATE TABLE shared.ai_briefings (
  briefing_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- NULL business = cross-brand (whole-Hub) briefing
  schedule_type         TEXT        NOT NULL
                        CHECK (schedule_type IN ('realtime','daily','weekly','manual')),
  scheduled_for         TIMESTAMPTZ NOT NULL,
  -- Window of insights summarised for this briefing
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,
  -- The intended reader (V1 = the CEO; later may broaden)
  recipient_user_id     UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  -- The summarised input that was fed to the model (the tier-1 facts)
  source_summary        JSONB       NOT NULL,
  -- The AI-written briefing
  briefing_text         TEXT,
  -- Items the briefing references (denormalised for quick joins)
  insight_count         INTEGER     NOT NULL DEFAULT 0,
  -- Cost capture
  provider              TEXT,
  model                 TEXT,
  tokens_used           INTEGER,
  cost_ngn              NUMERIC(12,4),
  -- Lifecycle
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','generating','generated','failed','skipped_budget','skipped_disabled')),
  generated_at          TIMESTAMPTZ,
  failure_reason        TEXT,
  -- Read tracking
  delivered_at          TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_briefings_recipient
  ON shared.ai_briefings (recipient_user_id, scheduled_for DESC)
  WHERE recipient_user_id IS NOT NULL;
CREATE INDEX idx_ai_briefings_pending
  ON shared.ai_briefings (scheduled_for) WHERE status = 'pending';

-- ── ai_briefing_insight_refs ─────────────────────────────
-- Many-to-many between briefings and the insight rows they reference.
-- Lets the UI render "this paragraph references these alerts" links.
CREATE TABLE shared.ai_briefing_insight_refs (
  ref_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_id           UUID        NOT NULL REFERENCES shared.ai_briefings (briefing_id) ON DELETE CASCADE,
  -- Which tier-1 table the referenced insight lives in
  insight_category      TEXT        NOT NULL
                        CHECK (insight_category IN ('stock','margin','invoice','intercompany',
                                                    'attendance','approval')),
  -- Soft FK to the row inside the relevant tier-1 table
  insight_id            UUID        NOT NULL,
  excerpt               TEXT,
  display_order         SMALLINT    NOT NULL DEFAULT 0
);
CREATE INDEX idx_ai_briefing_refs_briefing ON shared.ai_briefing_insight_refs (briefing_id, display_order);
CREATE INDEX idx_ai_briefing_refs_insight  ON shared.ai_briefing_insight_refs (insight_category, insight_id);

-- ============================================================
-- Verify
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'shared' AND table_name LIKE 'ai_%'
-- ORDER BY table_name;
-- Expected: 17 rows
--   ai_access_grants
--   ai_action_catalogue
--   ai_briefing_insight_refs
--   ai_briefings
--   ai_budget_periods
--   ai_conversations
--   ai_feature_flags
--   ai_insight_approval_queue_alerts
--   ai_insight_attendance_anomalies
--   ai_insight_intercompany_alerts
--   ai_insight_invoice_alerts
--   ai_insight_margin_breaches
--   ai_insight_stock_alerts
--   ai_knowledge_chunks
--   ai_messages
--   ai_pending_actions
--   ai_run_steps
--   ai_usage_daily
--   ai_usage_ledger
-- ============================================================
