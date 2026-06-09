-- ============================================================
-- 000112_shared_email_signature_template
-- W-12 (V2.2 §6.13): one branded email-signature template per business,
-- auto-personalised per staff member. The rendered per-staff signatures
-- already live in shared.email_signatures (000004); this adds the single
-- editable template they are generated from.
--
-- Merge tokens supported by the renderer: {{full_name}}, {{job_title}},
-- {{phone}}, {{business_name}}.
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE shared.business_config
  ADD COLUMN IF NOT EXISTS email_signature_template TEXT NOT NULL DEFAULT
$tpl$<table style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0A1128">
  <tr><td style="font-weight:bold;font-size:15px">{{full_name}}</td></tr>
  <tr><td style="color:#475569">{{job_title}} — {{business_name}}</td></tr>
  <tr><td style="color:#475569">{{phone}}</td></tr>
</table>$tpl$;
