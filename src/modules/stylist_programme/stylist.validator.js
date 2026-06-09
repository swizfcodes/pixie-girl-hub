/**
 * Stylist Partner Programme (V2.2 §6.26) — Zod validators.
 */

"use strict";

const { z } = require("zod");

const partnerCreate = z
  .object({
    contact_id: z.string().uuid(),
    display_name: z.string().min(1).max(160),
    country_code: z.string().min(2).max(3),
    city: z.string().min(1).max(120),
    state: z.string().max(120).optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    service_radius_km: z.coerce.number().int().positive().optional(),
    max_active_assignments: z.coerce.number().int().positive().optional(),
    payout_currency: z.string().length(3).optional(),
    bio: z.string().max(2000).optional(),
    portfolio_url: z.string().url().max(500).optional(),
    login_email: z.string().email().optional(),
    login_password: z.string().min(8).max(200).optional(),
  })
  .strict();

const partnerUpdate = z
  .object({
    display_name: z.string().min(1).max(160).optional(),
    country_code: z.string().min(2).max(3).optional(),
    city: z.string().min(1).max(120).optional(),
    state: z.string().max(120).optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    service_radius_km: z.coerce.number().int().positive().optional(),
    max_active_assignments: z.coerce.number().int().positive().optional(),
    payout_currency: z.string().length(3).optional(),
    payout_bank_name: z.string().max(160).optional(),
    payout_account_number: z.string().max(64).optional(),
    payout_account_name: z.string().max(160).optional(),
    paystack_recipient_code: z.string().max(120).optional(),
    bio: z.string().max(2000).optional(),
    portfolio_url: z.string().url().max(500).optional(),
  })
  .strict();

const statusChange = z
  .object({
    status: z.enum([
      "applicant",
      "vetting",
      "vetted",
      "certified",
      "suspended",
      "terminated",
    ]),
    reason: z.string().max(1000).optional(),
  })
  .strict();

const specialitySet = z
  .object({
    service_key: z.string().min(1).max(60),
    display_name: z.string().min(1).max(160),
    rate: z.coerce.number().nonnegative(),
    duration_minutes: z.coerce.number().int().positive().optional(),
    pending_admin_review: z.boolean().optional(),
  })
  .strict();

const certAward = z
  .object({
    tier_key: z.string().min(1).max(40),
    expires_at: z.string().datetime(),
    document_id: z.string().uuid().optional(),
    assessment_score: z.coerce.number().min(0).max(100).optional(),
    assessment_notes: z.string().max(2000).optional(),
  })
  .strict();

const assignmentOpen = z
  .object({
    customer_contact_id: z.string().uuid(),
    reference_type: z.enum([
      "sales_order",
      "service_booking",
      "production_run",
    ]),
    reference_id: z.string().uuid(),
    service_key: z.string().min(1).max(60),
    base_rate: z.coerce.number().nonnegative().optional(),
    platform_fee_pct: z.coerce.number().min(0).max(100).optional(),
    payout_currency: z.string().length(3).optional(),
    offer_window_hours: z.coerce.number().int().positive().max(720).optional(),
    offer_expires_at: z.string().datetime().optional(),
    scheduled_at: z.string().datetime().optional(),
    service_address: z.record(z.any()).optional(),
    candidate_stylist_ids: z.array(z.string().uuid()).optional(),
  })
  .strict();

const payoutGenerate = z
  .object({
    stylist_id: z.string().uuid(),
    period_start: z.string().date(),
    period_end: z.string().date(),
  })
  .strict();

const ratingBody = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    review: z.string().max(2000).optional(),
  })
  .strict();

const reasonBody = z
  .object({ reason: z.string().max(1000).optional() })
  .strict();
const paidBody = z
  .object({ transfer_code: z.string().max(120).optional() })
  .strict();
const loginBody = z
  .object({ email: z.string().email(), password: z.string().min(1).max(200) })
  .strict();

const mk = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body || {});
  next();
};

module.exports = {
  validatePartnerCreate: mk(partnerCreate),
  validatePartnerUpdate: mk(partnerUpdate),
  validateStatusChange: mk(statusChange),
  validateSpecialitySet: mk(specialitySet),
  validateCertAward: mk(certAward),
  validateAssignmentOpen: mk(assignmentOpen),
  validatePayoutGenerate: mk(payoutGenerate),
  validateRating: mk(ratingBody),
  validateReason: mk(reasonBody),
  validatePaid: mk(paidBody),
  validateLogin: mk(loginBody),
};
