-- ============================================================
-- 000102_shared_sales_campaign_permissions
--
-- Sales Campaigns (Module 6.22) RBAC completion.
--
-- The base seed (000015) granted only view/create/edit on
-- `sales_campaigns` to the owner role. The module's lifecycle needs
-- approve / delete / export, and operational roles need their grants so
-- the module is usable by more than the owner. CEO users bypass RBAC
-- entirely (is_ceo), so this is for the role-based actors.
--
-- shared.permissions UNIQUE (role_id, module, action) → idempotent upsert.
--
-- The `campaign_approval` workflow definition is NOT seeded here: it
-- references shared.business_config (populated at brand bootstrap, after
-- shared migrations). The workflow engine lazily creates the default
-- definition on first submit (see src/workflows/engine.js).
-- ============================================================

-- Role IDs (from 000015_shared_seed_data):
--   owner=...0001  admin=...0002  manager=...0003
--   staff=...0004  accountant=...0005  viewer=...0006

INSERT INTO shared.permissions (role_id, module, action, record_scope) VALUES
  -- owner: full control
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'view',    'all'),
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'create',  'all'),
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'edit',    'all'),
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'delete',  'all'),
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'approve', 'all'),
  ('11111111-1111-1111-1111-000000000001', 'sales_campaigns', 'export',  'all'),
  -- admin: full operational control
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'view',    'all'),
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'create',  'all'),
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'edit',    'all'),
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'delete',  'all'),
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'approve', 'all'),
  ('11111111-1111-1111-1111-000000000002', 'sales_campaigns', 'export',  'all'),
  -- manager: build + approve (no hard delete)
  ('11111111-1111-1111-1111-000000000003', 'sales_campaigns', 'view',    'all'),
  ('11111111-1111-1111-1111-000000000003', 'sales_campaigns', 'create',  'all'),
  ('11111111-1111-1111-1111-000000000003', 'sales_campaigns', 'edit',    'all'),
  ('11111111-1111-1111-1111-000000000003', 'sales_campaigns', 'approve', 'all'),
  ('11111111-1111-1111-1111-000000000003', 'sales_campaigns', 'export',  'all'),
  -- staff: build drafts only (own records)
  ('11111111-1111-1111-1111-000000000004', 'sales_campaigns', 'view',    'own'),
  ('11111111-1111-1111-1111-000000000004', 'sales_campaigns', 'create',  'own'),
  ('11111111-1111-1111-1111-000000000004', 'sales_campaigns', 'edit',    'own'),
  -- accountant: read + export for reconciliation
  ('11111111-1111-1111-1111-000000000005', 'sales_campaigns', 'view',    'all'),
  ('11111111-1111-1111-1111-000000000005', 'sales_campaigns', 'export',  'all'),
  -- viewer: read-only
  ('11111111-1111-1111-1111-000000000006', 'sales_campaigns', 'view',    'all')
ON CONFLICT (role_id, module, action) DO NOTHING;
