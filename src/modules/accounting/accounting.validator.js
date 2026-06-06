/**
 * Accounting & Finance (V2.2 §6.6) — Zod validators.
 */

"use strict";

const { z } = require("zod");
const money = z.coerce.number().nonnegative();

const accountCreate = z
  .object({
    account_code: z.string().min(1).max(20),
    account_name: z.string().min(1).max(200),
    group_id: z.string().uuid(),
    parent_account_id: z.string().uuid().optional(),
    description: z.string().max(1000).optional(),
    is_control_account: z.boolean().optional(),
    control_subledger: z.enum(["AR", "AP", "inventory", "payroll"]).optional(),
    tax_code: z.string().max(20).optional(),
    account_currency: z.string().max(4).optional(),
    allow_posting: z.boolean().optional(),
    is_active: z.boolean().optional(),
    display_order: z.coerce.number().int().min(0).optional(),
  })
  .strict();

const periodCreate = z
  .object({
    fiscal_year: z.coerce.number().int(),
    period_number: z.coerce.number().int().min(1).max(13),
    period_name: z.string().min(1).max(60),
    starts_on: z.string().date(),
    ends_on: z.string().date(),
    status: z
      .enum(["future", "open", "closing", "closed", "adjusted", "locked"])
      .optional(),
    is_year_end: z.boolean().optional(),
  })
  .strict();

const journalLine = z
  .object({
    account_id: z.string().uuid().optional(),
    account_code: z.string().max(20).optional(),
    debit_ngn: money.optional(),
    credit_ngn: money.optional(),
    description: z.string().max(500).optional(),
    contact_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    cost_centre: z.string().max(60).optional(),
    project: z.string().max(60).optional(),
  })
  .strict()
  .refine((l) => !!l.account_id !== !!l.account_code, {
    message: "provide exactly one of account_id or account_code",
  })
  .refine(
    (l) =>
      (l.debit_ngn ? 1 : 0) + (l.credit_ngn ? 1 : 0) === 1 ||
      (l.debit_ngn ?? 0) > 0 ||
      (l.credit_ngn ?? 0) > 0,
    { message: "a line must have a debit or a credit" },
  );

const manualJournal = z
  .object({
    description: z.string().min(1).max(500),
    reference: z.string().max(120).optional(),
    posting_date: z.string().date().optional(),
    lines: z.array(journalLine).min(2),
  })
  .strict();

const reverseReason = z
  .object({ reason: z.string().max(500).optional() })
  .strict();

const mw = (s) => (req, _res, next) => {
  req.body = s.parse(req.body ?? {});
  next();
};

const groupUpdate = z
  .object({
    group_name: z.string().min(1).max(120).optional(),
    display_order: z.coerce.number().int().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

module.exports = {
  validateAccountCreate: mw(accountCreate),
  validateAccountUpdate: mw(accountCreate.partial()),
  validateGroupUpdate: mw(groupUpdate),
  validatePeriodCreate: mw(periodCreate),
  validateManualJournal: mw(manualJournal),
  validateReverseReason: mw(reverseReason),
  accountCreate,
  periodCreate,
  manualJournal,
};
