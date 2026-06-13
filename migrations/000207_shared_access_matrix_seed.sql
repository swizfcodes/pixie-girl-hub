-- ============================================================
-- 000207_shared_access_matrix_seed
--
-- Seeds the V2.2 §3 "Access Matrix (Role × Module)" — the authoritative
-- role→permission map the spec calls "the map the developer builds against".
--
-- Prior migrations (000104..000110) seed the GENERIC system roles
-- (admin/manager/staff/accountant/viewer) with broad developer-chosen grants.
-- This migration adds the spec's NAMED operational roles and their EXACT grants
-- from the product-description matrix, so the policy the business actually runs
-- on is encoded — not approximated.
--
-- Roles (spec column → role here):
--   CEO + Finance (Faith) ... existing 'owner' (also is_ceo → bypasses RBAC)
--   HR / Admin .............. hr_admin
--   Operations Mgr .......... ops_mgr
--   Sales Rep ............... sales_rep
--   Technical / Stylist ..... tech_stylist
--   Marketing / Partner ..... mktg_partner
--   Security ................ security
--   China Production Mgr .... china_prod
--   Finance (future seat) ... finance
--
-- Grant-level → (actions, record_scope) mapping (matrix is module-level; the
-- spec's examples — "a rep only submits; Operations approves" — drive this):
--   full          → view, create, edit, delete, approve, export   scope 'all'
--   partial_team  → view, create, edit                            scope 'team'
--   partial_own   → view, create, edit                            scope 'own'
--   partial_read  → view                                          scope 'team'
--                   (reporting/append-only modules: dashboards, ai_insights, audit)
--
-- Notes:
--  * 12 enforced module keys are not printed in the matrix grid
--    (ai_governance, praxis_ai, ai_insights, audit, intercompany, org_workflow,
--     retail_partners, retention, sales_campaigns, service_jobs, settings,
--     storefront_studio). Their grants below are EXTRAPOLATED from the spec's
--     prose (CEO controls AI; partnerships under Marketing; finance owns
--     intercompany; Access/settings is CEO-only) and are easy to tune.
--  * record_scope 'own'/'team' is enforced in each module's repo; this only
--    seeds module × action existence (= allowed) + the scope hint.
--  * FOLLOW-UP (not done here): field-level privacy — "cost & pay are private".
--    shared.permissions.hidden_fields is the mechanism; seeding it needs the
--    real sensitive column names per table (cost_price/landed_cost/salary/…).
--  * Idempotent via UNIQUE (role_id, module, action). CEO/owner bypasses anyway.
-- ============================================================

-- 1) Named operational roles (system roles, applicable to any business).
INSERT INTO shared.roles (role_id, role_name, business, is_system, description) VALUES
  ('22222222-2222-2222-2222-000000000001', 'hr_admin',     NULL, true, 'HR / Admin — people, attendance, documents, payroll'),
  ('22222222-2222-2222-2222-000000000002', 'ops_mgr',      NULL, true, 'Operations Manager — runs sales/stock/logistics/purchasing (no cost or accounting)'),
  ('22222222-2222-2222-2222-000000000003', 'sales_rep',    NULL, true, 'Sales Rep — own customers and own sales only'),
  ('22222222-2222-2222-2222-000000000004', 'tech_stylist', NULL, true, 'Technical / Stylist — service jobs and own work'),
  ('22222222-2222-2222-2222-000000000005', 'mktg_partner', NULL, true, 'Marketing / Partnerships — campaigns, social, storefront, partners'),
  ('22222222-2222-2222-2222-000000000006', 'security',     NULL, true, 'Security — attendance and audit visibility'),
  ('22222222-2222-2222-2222-000000000007', 'china_prod',   NULL, true, 'China Production Manager — production, purchasing, logistics (RMB chain)'),
  ('22222222-2222-2222-2222-000000000008', 'finance',      NULL, true, 'Finance (future seat) — accounting, invoicing, expenses, intercompany')
ON CONFLICT (role_id) DO NOTHING;

-- 2) Expand the matrix (role_key, module, level) into permission rows.
INSERT INTO shared.permissions (role_id, module, action, record_scope)
SELECT r.role_id, g.module, a.action, a.scope
FROM (VALUES
        ('owner',        '11111111-1111-1111-1111-000000000001'::uuid),
        ('hr_admin',     '22222222-2222-2222-2222-000000000001'::uuid),
        ('ops_mgr',      '22222222-2222-2222-2222-000000000002'::uuid),
        ('sales_rep',    '22222222-2222-2222-2222-000000000003'::uuid),
        ('tech_stylist', '22222222-2222-2222-2222-000000000004'::uuid),
        ('mktg_partner', '22222222-2222-2222-2222-000000000005'::uuid),
        ('security',     '22222222-2222-2222-2222-000000000006'::uuid),
        ('china_prod',   '22222222-2222-2222-2222-000000000007'::uuid),
        ('finance',      '22222222-2222-2222-2222-000000000008'::uuid)
     ) AS r(role_key, role_id)
JOIN (VALUES
  -- CEO + Finance (owner): full across every enforced module
  ('owner','accounting','full'),('owner','ad_analytics','full'),('owner','ai_governance','full'),
  ('owner','ai_insights','full'),('owner','attendance','full'),('owner','audit','full'),
  ('owner','business_setup','full'),('owner','calendar','full'),('owner','contacts','full'),
  ('owner','crm','full'),('owner','dashboards','full'),('owner','documents','full'),
  ('owner','email_campaigns','full'),('owner','expenses','full'),('owner','hr_payroll','full'),
  ('owner','intercompany','full'),('owner','invoicing','full'),('owner','logistics','full'),
  ('owner','org_workflow','full'),('owner','pos','full'),('owner','praxis_ai','full'),
  ('owner','pricing','full'),('owner','production','full'),('owner','purchasing','full'),
  ('owner','retail_partners','full'),('owner','retention','full'),('owner','sales','full'),
  ('owner','sales_campaigns','full'),('owner','service_jobs','full'),('owner','settings','full'),
  ('owner','smartcomm','full'),('owner','social','full'),('owner','stock','full'),
  ('owner','storefront','full'),('owner','storefront_studio','full'),('owner','stylist_programme','full'),
  ('owner','tasks','full'),
  -- HR / Admin
  ('hr_admin','attendance','full'),('hr_admin','audit','partial_read'),('hr_admin','calendar','full'),
  ('hr_admin','contacts','full'),('hr_admin','dashboards','partial_read'),('hr_admin','documents','full'),
  ('hr_admin','expenses','partial_team'),('hr_admin','hr_payroll','full'),('hr_admin','org_workflow','partial_team'),
  ('hr_admin','smartcomm','partial_team'),('hr_admin','tasks','full'),
  -- Operations Manager (note: NO accounting, NO cost visibility per spec)
  ('ops_mgr','ai_insights','partial_read'),('ops_mgr','attendance','full'),('ops_mgr','calendar','full'),
  ('ops_mgr','contacts','full'),('ops_mgr','crm','full'),('ops_mgr','dashboards','partial_read'),
  ('ops_mgr','documents','full'),('ops_mgr','expenses','full'),('ops_mgr','hr_payroll','partial_team'),
  ('ops_mgr','intercompany','partial_team'),('ops_mgr','invoicing','full'),('ops_mgr','logistics','full'),
  ('ops_mgr','pos','full'),('ops_mgr','praxis_ai','partial_read'),('ops_mgr','pricing','partial_team'),
  ('ops_mgr','production','partial_team'),('ops_mgr','purchasing','full'),('ops_mgr','retail_partners','partial_team'),
  ('ops_mgr','retention','full'),('ops_mgr','sales','full'),('ops_mgr','sales_campaigns','partial_team'),
  ('ops_mgr','service_jobs','partial_team'),('ops_mgr','smartcomm','full'),('ops_mgr','stock','partial_team'),
  ('ops_mgr','storefront','partial_team'),('ops_mgr','storefront_studio','partial_team'),
  ('ops_mgr','stylist_programme','partial_team'),('ops_mgr','tasks','full'),
  -- Sales Rep (own customers / own sales)
  ('sales_rep','attendance','full'),('sales_rep','calendar','partial_own'),('sales_rep','contacts','partial_own'),
  ('sales_rep','crm','partial_own'),('sales_rep','dashboards','partial_read'),('sales_rep','documents','partial_own'),
  ('sales_rep','expenses','partial_own'),('sales_rep','logistics','partial_own'),('sales_rep','pos','partial_own'),
  ('sales_rep','retention','partial_own'),('sales_rep','sales','full'),('sales_rep','sales_campaigns','partial_own'),
  ('sales_rep','smartcomm','partial_own'),('sales_rep','stock','partial_own'),('sales_rep','tasks','partial_own'),
  -- Technical / Stylist
  ('tech_stylist','attendance','full'),('tech_stylist','calendar','partial_own'),('tech_stylist','contacts','partial_own'),
  ('tech_stylist','crm','partial_own'),('tech_stylist','expenses','partial_own'),('tech_stylist','service_jobs','full'),
  ('tech_stylist','tasks','partial_own'),
  -- Marketing / Partnerships
  ('mktg_partner','ad_analytics','full'),('mktg_partner','ai_insights','partial_read'),('mktg_partner','attendance','full'),
  ('mktg_partner','calendar','partial_team'),('mktg_partner','contacts','partial_team'),('mktg_partner','dashboards','partial_read'),
  ('mktg_partner','documents','partial_team'),('mktg_partner','email_campaigns','full'),('mktg_partner','expenses','partial_team'),
  ('mktg_partner','retail_partners','partial_team'),('mktg_partner','retention','partial_team'),('mktg_partner','sales_campaigns','full'),
  ('mktg_partner','smartcomm','partial_team'),('mktg_partner','social','full'),('mktg_partner','storefront','partial_team'),
  ('mktg_partner','storefront_studio','partial_team'),('mktg_partner','stylist_programme','partial_team'),('mktg_partner','tasks','partial_team'),
  -- Security
  ('security','attendance','full'),('security','audit','partial_read'),
  -- China Production Manager
  ('china_prod','calendar','partial_team'),('china_prod','contacts','partial_team'),('china_prod','dashboards','partial_read'),
  ('china_prod','documents','partial_team'),('china_prod','expenses','partial_team'),('china_prod','logistics','partial_team'),
  ('china_prod','pricing','partial_team'),('china_prod','production','full'),('china_prod','purchasing','partial_team'),
  ('china_prod','tasks','partial_team'),
  -- Finance (future seat)
  ('finance','accounting','full'),('finance','ai_insights','partial_read'),('finance','attendance','full'),
  ('finance','calendar','partial_team'),('finance','contacts','partial_team'),('finance','crm','partial_team'),
  ('finance','dashboards','partial_read'),('finance','documents','partial_team'),('finance','expenses','full'),
  ('finance','hr_payroll','partial_team'),('finance','intercompany','full'),('finance','invoicing','full'),
  ('finance','pos','partial_team'),('finance','pricing','partial_team'),('finance','production','partial_team'),
  ('finance','purchasing','partial_team'),('finance','sales','partial_team'),('finance','stock','partial_team'),
  ('finance','storefront','partial_team'),('finance','stylist_programme','partial_team'),('finance','tasks','partial_team')
     ) AS g(role_key, module, lvl) ON g.role_key = r.role_key
JOIN (VALUES
        ('full','view','all'),('full','create','all'),('full','edit','all'),
        ('full','delete','all'),('full','approve','all'),('full','export','all'),
        ('partial_team','view','team'),('partial_team','create','team'),('partial_team','edit','team'),
        ('partial_own','view','own'),('partial_own','create','own'),('partial_own','edit','own'),
        ('partial_read','view','team')
     ) AS a(lvl, action, scope) ON a.lvl = g.lvl
ON CONFLICT (role_id, module, action) DO NOTHING;
