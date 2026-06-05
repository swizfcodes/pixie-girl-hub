-- ============================================================
-- MIGRATION 000003 — Shared people, identity, RBAC, workflow
-- Pixie Girl Hub · JBS Praxis · V2.0
--
-- contacts, contact_addresses, contact_tags, contact_segments,
-- roles, users, user_sessions, refresh_tokens, permissions,
-- user_roles, org_units, org_positions,
-- workflow_definitions, workflow_instances, workflow_decisions,
-- staff_profiles, staff_contracts, staff_assets, leave_requests,
-- geofences, staff_clock_events
-- ============================================================

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ CONTACTS                                                           ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── contacts ─────────────────────────────────────────────
-- Master record for every person/org the platform interacts with.
-- One row regardless of how many brands they engage with.
CREATE TABLE shared.contacts (
  contact_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Array: any combo of 'customer','supplier','staff','retail_partner','stylist_partner'
  contact_type          TEXT[]      NOT NULL DEFAULT '{}',
  display_name          TEXT        NOT NULL,
  first_name            TEXT,
  last_name             TEXT,
  company_name          TEXT,
  gender                TEXT        CHECK (gender IN ('M','F','other','prefer_not')),
  date_of_birth         DATE,
  tin                   TEXT        UNIQUE,           -- Nigerian Tax ID
  cac_number            TEXT,
  primary_phone         TEXT        NOT NULL,
  whatsapp_number       TEXT,
  email                 CITEXT,
  -- ISO 2-letter country code. Set from geo-detection on storefront
  -- and used by the customer routing service in Module 6.26.
  country_code          TEXT,
  -- Storefront customer fields
  storefront_password_hash TEXT,                       -- bcrypt; NULL = not a storefront customer
  storefront_email_verified BOOLEAN NOT NULL DEFAULT false,
  -- Per-brand priority
  priority_level        TEXT        NOT NULL DEFAULT 'regular'
                        CHECK (priority_level IN ('vip','regular','new')),
  assigned_to           UUID,                          -- FK added after users table
  -- Array of business_keys this contact is visible to; empty = all
  visible_to            TEXT[]      NOT NULL DEFAULT '{}',
  source                TEXT,                          -- 'walk_in','social_media','referral','website','event','storefront','instagram_dm'
  notes                 TEXT,
  -- Storefront device fingerprint to power referral anti-fraud
  signup_device_fingerprint TEXT,
  signup_ip             INET,
  is_deleted            BOOLEAN     NOT NULL DEFAULT false,
  created_by            UUID,                          -- FK added after users table
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON shared.contacts
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

CREATE INDEX idx_contacts_phone        ON shared.contacts (primary_phone);
CREATE INDEX idx_contacts_email        ON shared.contacts (email);
CREATE INDEX idx_contacts_type         ON shared.contacts USING GIN (contact_type);
CREATE INDEX idx_contacts_priority     ON shared.contacts (priority_level) WHERE is_deleted = false;
CREATE INDEX idx_contacts_assigned     ON shared.contacts (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_contacts_display_trgm ON shared.contacts USING GIN (display_name gin_trgm_ops);

-- ── contact_addresses ────────────────────────────────────
-- Normalised address table for structured queries (e.g. find all
-- customers in Lagos Island). Customers may have many addresses
-- (default delivery, billing, home, office).
CREATE TABLE shared.contact_addresses (
  address_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  address_type          TEXT        NOT NULL DEFAULT 'delivery'
                        CHECK (address_type IN ('delivery','billing','office','home','other')),
  line1                 TEXT        NOT NULL,
  line2                 TEXT,
  area                  TEXT,                            -- e.g. Victoria Island, Lekki Phase 1
  city                  TEXT        NOT NULL DEFAULT 'Lagos',
  state                 TEXT        NOT NULL DEFAULT 'Lagos',
  country               TEXT        NOT NULL DEFAULT 'Nigeria',
  country_code          TEXT        NOT NULL DEFAULT 'NG',
  postal_code           TEXT,
  landmark              TEXT,
  recipient_name        TEXT,
  recipient_phone       TEXT,
  google_maps_url       TEXT,
  latitude              NUMERIC(10,7),
  longitude             NUMERIC(10,7),
  is_default            BOOLEAN     NOT NULL DEFAULT false,
  is_verified           BOOLEAN     NOT NULL DEFAULT false, -- confirmed via successful delivery
  created_by            UUID,                              -- FK added after users
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_contact_addresses_updated_at
  BEFORE UPDATE ON shared.contact_addresses
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE UNIQUE INDEX idx_contact_addresses_default
  ON shared.contact_addresses (contact_id, address_type) WHERE is_default = true;
CREATE INDEX idx_contact_addresses_contact ON shared.contact_addresses (contact_id);
CREATE INDEX idx_contact_addresses_city    ON shared.contact_addresses (city, state)
  WHERE is_default = true;

-- ── contact_tags ─────────────────────────────────────────
CREATE TABLE shared.contact_tags (
  tag_id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL REFERENCES shared.contacts (contact_id) ON DELETE CASCADE,
  tag_name              TEXT        NOT NULL,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  colour                TEXT        DEFAULT '#64748B',
  created_by            UUID,                              -- FK after users
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, tag_name, business)
);
CREATE INDEX idx_contact_tags_contact ON shared.contact_tags (contact_id);
CREATE INDEX idx_contact_tags_name    ON shared.contact_tags (business, tag_name);

-- ── contact_segments ─────────────────────────────────────
-- Reusable named audience filters for email/WhatsApp campaigns.
CREATE TABLE shared.contact_segments (
  segment_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  description           TEXT,
  filter                JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Cached count refreshed by background job for the dashboard.
  cached_count          INTEGER     NOT NULL DEFAULT 0,
  cached_at             TIMESTAMPTZ,
  created_by            UUID,                              -- FK after users
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, name)
);
CREATE TRIGGER trg_contact_segments_updated_at
  BEFORE UPDATE ON shared.contact_segments
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_contact_segments_business ON shared.contact_segments (business);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ ORG CHART, ROLES, USERS                                            ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── org_units ────────────────────────────────────────────
-- Departments and teams. Tree structure via parent_unit_id.
-- Module 6.27 (Organisation & Workflow Builder) edits this live.
CREATE TABLE shared.org_units (
  unit_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  parent_unit_id        UUID        REFERENCES shared.org_units (unit_id) ON DELETE SET NULL,
  unit_key              TEXT        NOT NULL,           -- 'operations','finance','marketing'
  display_name          TEXT        NOT NULL,
  display_order         SMALLINT    NOT NULL DEFAULT 0,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, unit_key)
);
CREATE TRIGGER trg_org_units_updated_at
  BEFORE UPDATE ON shared.org_units
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_org_units_parent ON shared.org_units (parent_unit_id) WHERE parent_unit_id IS NOT NULL;

-- ── roles ────────────────────────────────────────────────
CREATE TABLE shared.roles (
  role_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name             TEXT        NOT NULL,
  -- Brand scope: NULL = system role usable across any brand;
  -- otherwise tied to a specific business_key.
  business              TEXT        REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  is_system             BOOLEAN     NOT NULL DEFAULT false, -- system roles cannot be deleted
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_name, business)
);
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON shared.roles
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();

-- ── users ────────────────────────────────────────────────
-- Staff login accounts. Customer + stylist accounts use separate
-- mechanisms (storefront cookies / stylist_partners credentials).
CREATE TABLE shared.users (
  user_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_profile_id      UUID,                              -- FK after staff_profiles
  email                 CITEXT      NOT NULL UNIQUE,
  password_hash         TEXT        NOT NULL,              -- bcrypt cost ≥12
  -- 'staff' = full admin scope per RBAC; 'auditor' / 'reporter' kept
  -- for special-purpose internal users without role assignments.
  user_class            TEXT        NOT NULL DEFAULT 'staff'
                        CHECK (user_class IN ('staff','auditor','reporter')),
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  force_password_reset  BOOLEAN     NOT NULL DEFAULT true,
  last_login_at         TIMESTAMPTZ,
  last_login_ip         INET,
  failed_login_attempts SMALLINT    NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  default_business      TEXT        REFERENCES shared.business_config (business_key) ON DELETE SET NULL,
  permitted_businesses  TEXT[]      NOT NULL DEFAULT '{}', -- empty = none until granted
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON shared.users
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_users_email ON shared.users (email);

-- Wire deferred FKs on contacts and contact_addresses
ALTER TABLE shared.contacts
  ADD CONSTRAINT fk_contacts_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES shared.users (user_id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_contacts_created_by
    FOREIGN KEY (created_by) REFERENCES shared.users (user_id) ON DELETE SET NULL;

ALTER TABLE shared.contact_addresses
  ADD CONSTRAINT fk_contact_addresses_created_by
    FOREIGN KEY (created_by) REFERENCES shared.users (user_id) ON DELETE SET NULL;

ALTER TABLE shared.contact_tags
  ADD CONSTRAINT fk_contact_tags_created_by
    FOREIGN KEY (created_by) REFERENCES shared.users (user_id) ON DELETE SET NULL;

ALTER TABLE shared.contact_segments
  ADD CONSTRAINT fk_contact_segments_created_by
    FOREIGN KEY (created_by) REFERENCES shared.users (user_id) ON DELETE SET NULL;

ALTER TABLE shared.currency_rates
  ADD CONSTRAINT fk_currency_rates_set_by
    FOREIGN KEY (set_by) REFERENCES shared.users (user_id) ON DELETE SET NULL;

-- ── user_sessions ────────────────────────────────────────
CREATE TABLE shared.user_sessions (
  session_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  session_token         TEXT        NOT NULL UNIQUE,
  ip_address            INET,
  user_agent            TEXT,
  current_business      TEXT        REFERENCES shared.business_config (business_key) ON DELETE SET NULL,
  expires_at            TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_sessions_token   ON shared.user_sessions (session_token);
CREATE INDEX idx_user_sessions_user_id ON shared.user_sessions (user_id);

-- ── refresh_tokens ───────────────────────────────────────
CREATE TABLE shared.refresh_tokens (
  token_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  token_hash            TEXT        NOT NULL UNIQUE,           -- SHA-256 of raw token
  token_class           TEXT        NOT NULL DEFAULT 'staff'
                        CHECK (token_class IN ('staff','customer','stylist')),
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,                            -- NULL = active
  issued_ip             INET,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_hash ON shared.refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user ON shared.refresh_tokens (user_id);

-- ── permissions ──────────────────────────────────────────
-- The role × module × action matrix. Module 6.27 edits this live.
CREATE TABLE shared.permissions (
  permission_id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id               UUID        NOT NULL REFERENCES shared.roles (role_id) ON DELETE CASCADE,
  module                TEXT        NOT NULL,
  -- Modules: crm | sales | pos | storefront | invoicing | accounting
  --          stock | catalogue | purchasing | expenses | payroll
  --          logistics | retail_partners | messaging | social
  --          campaigns | sales_campaigns | retention | loyalty
  --          ad_analytics | production | pricing | stylists
  --          discounts | reports | calendar | tasks | dashboards
  --          documents | staff | clock_in | settings | workflow
  --          storefront_studio | intercompany
  action                TEXT        NOT NULL,
  -- Actions: view | create | edit | delete | approve | export
  record_scope          TEXT        NOT NULL DEFAULT 'all'
                        CHECK (record_scope IN ('all','own','team')),
  hidden_fields         TEXT[]      NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role_id, module, action)
);
CREATE INDEX idx_permissions_role_module ON shared.permissions (role_id, module);

-- ── user_roles ───────────────────────────────────────────
CREATE TABLE shared.user_roles (
  user_id               UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE CASCADE,
  role_id               UUID        NOT NULL REFERENCES shared.roles (role_id) ON DELETE CASCADE,
  business              TEXT        NOT NULL,   -- '*' for all businesses
  granted_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ,
  PRIMARY KEY (user_id, role_id, business)
);
CREATE INDEX idx_user_roles_user ON shared.user_roles (user_id);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ STAFF, ORG POSITIONS                                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── staff_profiles ───────────────────────────────────────
CREATE TABLE shared.staff_profiles (
  profile_id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id            UUID        NOT NULL UNIQUE REFERENCES shared.contacts (contact_id),
  employee_number       TEXT        NOT NULL UNIQUE,
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  department            TEXT,                                  -- legacy text; org_units is the new source of truth
  job_title             TEXT        NOT NULL,
  employment_type       TEXT        NOT NULL
                        CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  start_date            DATE        NOT NULL,
  end_date              DATE,                                   -- NULL = currently employed
  reports_to            UUID        REFERENCES shared.staff_profiles (profile_id) ON DELETE SET NULL,
  -- Encrypted at application layer (AES-256) before storage
  bank_name             TEXT,
  bank_account_number   TEXT,
  bank_sort_code        TEXT,
  nin                   TEXT,                                  -- National ID — encrypted
  bvn                   TEXT,                                  -- Bank Verification Number — encrypted
  base_salary           NUMERIC(12,2) NOT NULL DEFAULT 0,
  pension_pin           TEXT,
  nhf_number            TEXT,
  tax_id                TEXT,

  -- ─── HR policy fields (sourced from Faitlyn's documented employment terms) ───
  -- Probation tracking
  probation_status      TEXT        NOT NULL DEFAULT 'not_applicable'
                        CHECK (probation_status IN ('not_applicable','pending','active','passed','failed','extended')),
  probation_start_date  DATE,
  probation_end_date    DATE,
  probation_outcome     TEXT,                                   -- 'passed' | 'failed' | 'extended_by_n_months' + notes
  probation_outcome_at  TIMESTAMPTZ,
  probation_decided_by  UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,

  -- Leave entitlements (Faitlyn-style). Balances themselves are
  -- maintained by application logic over leave_requests + accrual,
  -- but the entitlement constants live with the profile.
  annual_leave_days_entitled   SMALLINT NOT NULL DEFAULT 0,
  annual_leave_days_remaining  NUMERIC(5,2) NOT NULL DEFAULT 0,  -- can be partial (0.5)
  public_holiday_days_used     SMALLINT NOT NULL DEFAULT 0,
  -- "Special Event Days" — staff worked a public event, get a
  -- day-off-in-lieu. Tracked as a separate bucket.
  special_event_days_owed      NUMERIC(5,2) NOT NULL DEFAULT 0,  -- bank of days owed
  special_event_days_taken     NUMERIC(5,2) NOT NULL DEFAULT 0,

  -- Non-solicitation window after exit (in months)
  non_solicit_months    SMALLINT    NOT NULL DEFAULT 0,         -- 0 = no restriction
  non_solicit_until     DATE,                                   -- computed: end_date + non_solicit_months
  non_solicit_signed_at DATE,                                   -- when clause was signed

  -- Summary-dismissal triggers — free-form HR reference. Concrete
  -- incidents are filed as documents + audit_log entries; this is
  -- the searchable summary the SOPs refer to.
  -- e.g. ["theft_2025_03","ghosting_warning_2025_07"]
  dismissal_triggers_log JSONB      NOT NULL DEFAULT '[]'::jsonb,

  is_deleted            BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ,
  -- If probation is active, dates must be valid
  CONSTRAINT probation_dates_valid CHECK (
    probation_status NOT IN ('active','pending') OR
    (probation_start_date IS NOT NULL AND probation_end_date IS NOT NULL
     AND probation_end_date > probation_start_date)
  )
);
CREATE TRIGGER trg_staff_profiles_updated_at
  BEFORE UPDATE ON shared.staff_profiles
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_staff_profiles_business ON shared.staff_profiles (business);
CREATE INDEX idx_staff_profiles_reports  ON shared.staff_profiles (reports_to) WHERE reports_to IS NOT NULL;
CREATE INDEX idx_staff_profiles_probation_ending
  ON shared.staff_profiles (probation_end_date)
  WHERE probation_status = 'active' AND is_deleted = false;
CREATE INDEX idx_staff_profiles_non_solicit_active
  ON shared.staff_profiles (non_solicit_until)
  WHERE non_solicit_until IS NOT NULL AND end_date IS NOT NULL;

-- Wire deferred FK on users → staff_profiles
ALTER TABLE shared.users
  ADD CONSTRAINT fk_users_staff_profile
    FOREIGN KEY (staff_profile_id) REFERENCES shared.staff_profiles (profile_id) ON DELETE SET NULL;

-- ── org_positions ────────────────────────────────────────
-- Specific positions within units (e.g. "Head of Finance"). Linked
-- to a staff_profile. Used by the workflow runner to find approvers.
--
-- Org model (per Module 6.27 V2.2):
--   • Every position has ONE solid-line manager (approval authority).
--     This is encoded as staff_profiles.reports_to between the holders.
--   • A position may have N dotted-line managers (information-sharing,
--     can-request-updates, NO approval authority). Captured in
--     org_position_dotted_lines below.
--   • A position may be flagged is_deputy — inherits "most of the
--     superior's operational capacities" so when the holder above
--     is unavailable, the deputy is the active approver.
CREATE TABLE shared.org_positions (
  position_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID        NOT NULL REFERENCES shared.org_units (unit_id) ON DELETE CASCADE,
  position_key          TEXT        NOT NULL,           -- 'head_of_finance'
  display_name          TEXT        NOT NULL,           -- 'Head of Finance'
  profile_id            UUID        REFERENCES shared.staff_profiles (profile_id) ON DELETE SET NULL,
  -- Solid-line reporting (the approval-authority manager position)
  reports_to_position_id UUID       REFERENCES shared.org_positions (position_id) ON DELETE SET NULL,
  is_management         BOOLEAN     NOT NULL DEFAULT false,
  -- Deputy flag: this position is configured as a deputy to its
  -- solid-line manager (e.g. future Salon Manager → CEO). When the
  -- manager is absent / on leave, approval routes automatically
  -- step down to this deputy.
  is_deputy             BOOLEAN     NOT NULL DEFAULT false,
  -- Snapshot of inherited capacities when is_deputy = true.
  -- e.g. ["sales.approve","expenses.approve","payroll.view"]
  deputy_capacities     TEXT[]      NOT NULL DEFAULT '{}',
  -- Approval threshold (NGN). For amount-based routes: this position
  -- may approve up to this value; above, escalates per
  -- workflow_definitions. NULL = no limit / no monetary auth.
  approval_threshold_ngn NUMERIC(14,2),
  display_order         SMALLINT    NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, position_key)
);
CREATE TRIGGER trg_org_positions_updated_at
  BEFORE UPDATE ON shared.org_positions
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_org_positions_profile  ON shared.org_positions (profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_org_positions_reports  ON shared.org_positions (reports_to_position_id)
  WHERE reports_to_position_id IS NOT NULL;
CREATE INDEX idx_org_positions_deputy   ON shared.org_positions (reports_to_position_id)
  WHERE is_deputy = true;

-- ── org_position_dotted_lines ────────────────────────────
-- Many-to-many: dotted-line relationships between positions.
-- A position may have many dotted superiors (typically CEO).
-- Dotted lines convey information rights, NOT approval rights —
-- workflow_definitions never route through these.
CREATE TABLE shared.org_position_dotted_lines (
  dotted_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id           UUID        NOT NULL REFERENCES shared.org_positions (position_id) ON DELETE CASCADE,
  dotted_to_position_id UUID        NOT NULL REFERENCES shared.org_positions (position_id) ON DELETE CASCADE,
  -- What rights this dotted line conveys
  rights                JSONB       NOT NULL DEFAULT '{
    "can_view_dashboards": true,
    "can_view_documents": true,
    "can_request_updates": true,
    "receives_notifications": true,
    "can_approve": false
  }'::jsonb,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (position_id, dotted_to_position_id),
  CONSTRAINT dotted_not_self CHECK (position_id <> dotted_to_position_id)
);
CREATE INDEX idx_org_dotted_from ON shared.org_position_dotted_lines (position_id);
CREATE INDEX idx_org_dotted_to   ON shared.org_position_dotted_lines (dotted_to_position_id);

-- ── staff_contracts ──────────────────────────────────────
-- Append-only. New row on every contract change.
CREATE TABLE shared.staff_contracts (
  contract_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID        NOT NULL REFERENCES shared.staff_profiles (profile_id) ON DELETE CASCADE,
  contract_type         TEXT        NOT NULL
                        CHECK (contract_type IN ('full_time','part_time','contract','amendment','termination')),
  effective_from        DATE        NOT NULL,
  effective_to          DATE,                                   -- NULL = currently active
  gross_salary          NUMERIC(12,2) NOT NULL,
  document_id           UUID,                                   -- FK added after documents
  notes                 TEXT,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_contracts_profile ON shared.staff_contracts (profile_id);

-- ── staff_assets ─────────────────────────────────────────
CREATE TABLE shared.staff_assets (
  asset_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID        NOT NULL REFERENCES shared.staff_profiles (profile_id) ON DELETE CASCADE,
  asset_type            TEXT        NOT NULL,                   -- 'tablet','laptop','keys','uniform'
  description           TEXT        NOT NULL,
  serial_number         TEXT,
  issued_date           DATE        NOT NULL,
  returned_date         DATE,
  condition_on_issue    TEXT,
  condition_on_return   TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_staff_assets_profile ON shared.staff_assets (profile_id);

-- ── leave_requests ───────────────────────────────────────
CREATE TABLE shared.leave_requests (
  leave_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID        NOT NULL REFERENCES shared.staff_profiles (profile_id) ON DELETE CASCADE,
  leave_type            TEXT        NOT NULL
                        CHECK (leave_type IN ('annual','sick','maternity','paternity',
                                              'compassionate','bereavement','unpaid',
                                              'special_event_in_lieu','public_holiday')),
  start_date            DATE        NOT NULL,
  end_date              DATE        NOT NULL,
  days_requested        SMALLINT    NOT NULL CHECK (days_requested > 0),
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by           UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  reason                TEXT,
  rejection_reason      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT leave_dates_valid CHECK (end_date >= start_date)
);
CREATE TRIGGER trg_leave_requests_updated_at
  BEFORE UPDATE ON shared.leave_requests
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_leave_requests_profile ON shared.leave_requests (profile_id);
CREATE INDEX idx_leave_requests_status  ON shared.leave_requests (status, start_date);

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ GEOLOCATION CLOCK-IN (Module 6.11.1)                               ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── geofences ────────────────────────────────────────────
-- Named locations (HQ, salon, warehouse) with centre lat/lng and
-- radius. A clock-in attempt must fall inside an active geofence
-- linked to the staff member's assigned org_unit.
CREATE TABLE shared.geofences (
  geofence_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,           -- 'Lekki HQ', 'Lagos Warehouse', 'Faitlyn Salon'
  unit_id               UUID        REFERENCES shared.org_units (unit_id) ON DELETE SET NULL,
  latitude              NUMERIC(10,7) NOT NULL,
  longitude             NUMERIC(10,7) NOT NULL,
  radius_m              INTEGER     NOT NULL CHECK (radius_m BETWEEN 10 AND 5000),
  address               TEXT,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_geofences_updated_at
  BEFORE UPDATE ON shared.geofences
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_geofences_business_active ON shared.geofences (business) WHERE is_active = true;

-- ── staff_clock_events ───────────────────────────────────
-- APPEND-ONLY. Every successful and rejected clock-in/out attempt.
CREATE TABLE shared.staff_clock_events (
  event_id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id            UUID        NOT NULL REFERENCES shared.staff_profiles (profile_id) ON DELETE CASCADE,
  event_type            TEXT        NOT NULL CHECK (event_type IN ('clock_in','clock_out')),
  latitude              NUMERIC(10,7),
  longitude             NUMERIC(10,7),
  accuracy_m            NUMERIC(8,2),
  device_fingerprint    TEXT,
  device_user_agent     TEXT,
  ip_address            INET,
  matched_geofence_id   UUID        REFERENCES shared.geofences (geofence_id) ON DELETE SET NULL,
  distance_m            NUMERIC(10,2),                  -- distance from matched geofence centre (if any)
  accepted              BOOLEAN     NOT NULL,
  rejection_reason      TEXT,                            -- 'outside_geofence' | 'accuracy_too_low' | 'permission_denied' | 'manager_override_required'
  -- Offline-queued events: original device timestamp preserved
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clock_events_profile ON shared.staff_clock_events (profile_id, occurred_at DESC);
CREATE INDEX idx_clock_events_rejected ON shared.staff_clock_events (profile_id, occurred_at DESC)
  WHERE accepted = false;

-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ WORKFLOW BUILDER (Module 6.27)                                     ║
-- ╚════════════════════════════════════════════════════════════════════╝

-- ── workflow_definitions ─────────────────────────────────
-- JSONB-stored approval flows authored by Module 6.27. The workflow
-- engine reads these at request time — there is no compiled matrix.
--
-- definition JSON shape (example with amount threshold + dotted-line
-- override + deputy fallback):
-- {
--   "trigger": {
--     "module":"expenses","action":"create",
--     "conditions":[{"field":"amount_ngn","op":">","value":50000}]
--   },
--   "stages": [
--     {
--       "order":1,
--       "approvers":[{"type":"manager_chain","value":"solid_line"}],
--       "amount_threshold_ngn": 200000,
--       "above_threshold_escalate_to":{"type":"role","value":"ceo"},
--       "timeout_hours":48,
--       "on_timeout":"escalate",
--       "fallback_to_deputy": true,
--       "fallback":{"type":"role","value":"owner"}
--     },
--     {
--       "order":2,
--       "approvers":[{"type":"role","value":"ceo"}],
--       "timeout_hours":72,
--       "on_timeout":"auto_approve"
--     }
--   ]
-- }
--
-- Routes never go through dotted lines — those are information-only
-- by design (see org_position_dotted_lines.rights.can_approve).
CREATE TABLE shared.workflow_definitions (
  workflow_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  description           TEXT,
  trigger_module        TEXT        NOT NULL,
  trigger_action        TEXT        NOT NULL,
  -- The full definition JSON (trigger + conditions + stages + fallbacks)
  definition            JSONB       NOT NULL,
  is_active             BOOLEAN     NOT NULL DEFAULT true,
  version               INTEGER     NOT NULL DEFAULT 1,
  -- Previous version pointer for rollback
  supersedes_id         UUID        REFERENCES shared.workflow_definitions (workflow_id) ON DELETE SET NULL,
  created_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business, name, version)
);
CREATE TRIGGER trg_workflow_definitions_updated_at
  BEFORE UPDATE ON shared.workflow_definitions
  FOR EACH ROW EXECUTE FUNCTION shared.fn_set_updated_at();
CREATE INDEX idx_workflow_definitions_trigger
  ON shared.workflow_definitions (business, trigger_module, trigger_action)
  WHERE is_active = true;

-- ── workflow_instances ───────────────────────────────────
-- A running instance: which document triggered it, current stage,
-- approvals received, final status. The original action is held
-- pending until the instance reaches 'approved' or 'rejected'.
CREATE TABLE shared.workflow_instances (
  instance_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id           UUID        NOT NULL REFERENCES shared.workflow_definitions (workflow_id),
  business              TEXT        NOT NULL REFERENCES shared.business_config (business_key) ON DELETE CASCADE,
  -- What triggered this instance
  reference_table       TEXT        NOT NULL,   -- e.g. 'expenses','sales_orders','discount_approvals'
  reference_id          UUID        NOT NULL,   -- ID in that table (in the brand schema)
  current_stage         SMALLINT    NOT NULL DEFAULT 1,
  status                TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','approved','rejected','cancelled','timeout_approved','timeout_rejected')),
  -- Snapshot of context for routing
  context               JSONB       NOT NULL DEFAULT '{}'::jsonb,
  initiated_by          UUID        NOT NULL REFERENCES shared.users (user_id) ON DELETE RESTRICT,
  initiated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  -- When the current stage was entered (for timeout sweep)
  stage_entered_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  stage_timeout_at      TIMESTAMPTZ
);
CREATE INDEX idx_workflow_instances_pending
  ON shared.workflow_instances (business, status, stage_timeout_at)
  WHERE status = 'pending';
CREATE INDEX idx_workflow_instances_reference
  ON shared.workflow_instances (reference_table, reference_id);

-- ── workflow_decisions ───────────────────────────────────
-- Per-approver decision log. Append-only.
CREATE TABLE shared.workflow_decisions (
  decision_id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id           UUID        NOT NULL REFERENCES shared.workflow_instances (instance_id) ON DELETE CASCADE,
  stage_number          SMALLINT    NOT NULL,
  decided_by            UUID        REFERENCES shared.users (user_id) ON DELETE SET NULL,
  decision              TEXT        NOT NULL CHECK (decision IN ('approve','reject','request_changes','timeout_auto')),
  comments              TEXT,
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_decisions_instance ON shared.workflow_decisions (instance_id, stage_number);

-- ============================================================
-- Verify
-- SELECT COUNT(*) FROM information_schema.tables
-- WHERE table_schema = 'shared';
-- After 000001+000002+000003: expected ~28 tables
-- ============================================================
