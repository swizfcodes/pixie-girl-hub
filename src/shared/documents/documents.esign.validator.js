/**
 * Documents & Signatures (V2.2 §6.13) — Zod validators for e-signatures.
 */

"use strict";

const { z } = require("zod");

const signer = z
  .object({
    user_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    external_name: z.string().min(1).max(160).optional(),
    external_email: z.string().email().optional(),
    external_phone: z.string().max(40).optional(),
    display_name: z.string().max(160).optional(),
    display_email: z.string().email().optional(),
    signer_role: z.string().min(1).max(40),
  })
  .strict()
  .refine((s) => s.user_id || s.contact_id || s.external_email, {
    message: "Each signer needs a user_id, contact_id, or external_email",
  });

const requestCreate = z
  .object({
    document_id: z.string().uuid(),
    request_type: z.enum([
      "stylist_partner_agreement",
      "employment_contract",
      "nda",
      "supplier_agreement",
      "service_agreement",
      "investor_document",
      "other",
    ]),
    reference_type: z.string().max(60).optional(),
    reference_id: z.string().uuid().optional(),
    signing_order: z.enum(["sequential", "parallel"]).optional(),
    subject: z.string().min(1).max(200),
    message: z.string().max(2000).optional(),
    expires_at: z.string().datetime().optional(),
    signers: z.array(signer).min(1),
  })
  .strict();

const voidBody = z.object({ reason: z.string().max(500).optional() }).strict();
const signBody = z
  .object({
    captured_signature_path: z.string().max(500).optional(),
    signature_image_byte_size: z.coerce.number().int().positive().optional(),
  })
  .strict();
const declineBody = z
  .object({ reason: z.string().max(500).optional() })
  .strict();

const mw = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body ?? {});
  next();
};

module.exports = {
  validateRequestCreate: mw(requestCreate),
  validateVoid: mw(voidBody),
  validateSign: mw(signBody),
  validateDecline: mw(declineBody),
  requestCreate,
};
