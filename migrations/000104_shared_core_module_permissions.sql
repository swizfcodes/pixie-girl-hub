-- ============================================================
-- 000104_shared_core_module_permissions
-- RBAC grants for the core modules built out in this pass:
--   documents, contacts, crm, stock, sales, invoicing, accounting, expenses
-- Idempotent (UNIQUE role_id,module,action). CEO bypasses RBAC.
--   owner=...0001 admin=...0002 manager=...0003 staff=...0004
--   accountant=...0005 viewer=...0006
-- ============================================================

-- owner + admin: full control on every core module
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT r.role_id, m.module, a.action, 'all'
FROM (VALUES
        ('11111111-1111-1111-1111-000000000001'::uuid),
        ('11111111-1111-1111-1111-000000000002'::uuid)) r(role_id),
     (VALUES ('documents'),('contacts'),('crm'),('stock'),('sales'),
             ('invoicing'),('accounting'),('expenses')) m(module),
     (VALUES ('view'),('create'),('edit'),('delete'),('approve'),('export')) a(action)
ON CONFLICT (role_id, module, action) DO NOTHING;

-- manager: build + approve (no hard delete)
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT '11111111-1111-1111-1111-000000000003'::uuid, m.module, a.action, 'all'
FROM (VALUES ('documents'),('contacts'),('crm'),('stock'),('sales'),
             ('invoicing'),('accounting'),('expenses')) m(module),
     (VALUES ('view'),('create'),('edit'),('approve'),('export')) a(action)
ON CONFLICT (role_id, module, action) DO NOTHING;

-- staff: operate (no delete/approve)
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT '11111111-1111-1111-1111-000000000004'::uuid, m.module, a.action, 'all'
FROM (VALUES ('documents'),('contacts'),('crm'),('stock'),('sales')) m(module),
     (VALUES ('view'),('create'),('edit')) a(action)
ON CONFLICT (role_id, module, action) DO NOTHING;

-- accountant: read everywhere + create/edit/export the financial modules
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT '11111111-1111-1111-1111-000000000005'::uuid, m.module, 'view', 'all'
FROM (VALUES ('documents'),('contacts'),('crm'),('stock'),('sales'),
             ('invoicing'),('accounting'),('expenses')) m(module)
ON CONFLICT (role_id, module, action) DO NOTHING;
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT '11111111-1111-1111-1111-000000000005'::uuid, m.module, a.action, 'all'
FROM (VALUES ('invoicing'),('accounting'),('expenses')) m(module),
     (VALUES ('create'),('edit'),('export')) a(action)
ON CONFLICT (role_id, module, action) DO NOTHING;

-- viewer: read-only
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT '11111111-1111-1111-1111-000000000006'::uuid, m.module, 'view', 'all'
FROM (VALUES ('documents'),('contacts'),('crm'),('stock'),('sales'),
             ('invoicing'),('accounting'),('expenses')) m(module)
ON CONFLICT (role_id, module, action) DO NOTHING;
