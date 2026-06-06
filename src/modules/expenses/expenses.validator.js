/**
 * Expense Management (V2.2 §6.7) — Zod validators.
 */

"use strict";

const { z } = require("zod");
const money = z.coerce.number().nonnegative();

const categoryCreate = z
  .object({
    category_key: z.string().min(1).max(60),
    display_name: z.string().min(1).max(160),
    description: z.string().max(1000).optional(),
    default_account_id: z.string().uuid().optional(),
    default_vat_rate: z.coerce.number().min(0).max(1).optional(),
    default_wht_rate: z.coerce.number().min(0).max(1).optional(),
    is_active: z.boolean().optional(),
    workflow_key_override: z.string().max(80).optional(),
    unusual_amount_threshold_ngn: money.optional(),
    display_order: z.coerce.number().int().min(0).optional(),
  })
  .strict();

const expenseLine = z
  .object({
    category_id: z.string().uuid(),
    description: z.string().min(1).max(500),
    amount_ngn: z.coerce.number().positive(),
    vat_amount_ngn: money.optional(),
    wht_amount_ngn: money.optional(),
    vendor_name: z.string().max(200).optional(),
    vendor_tin: z.string().max(40).optional(),
    receipt_date: z.string().date().optional(),
    account_id: z.string().uuid().optional(),
    project: z.string().max(60).optional(),
    cost_centre: z.string().max(60).optional(),
  })
  .strict();

const expenseCreate = z
  .object({
    expense_type: z
      .enum([
        "reimbursement",
        "advance_settlement",
        "company_card",
        "direct_invoice",
      ])
      .optional(),
    advance_id: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    expense_date: z.string().date(),
    description: z.string().max(2000).optional(),
    original_currency: z.string().max(4).optional(),
    original_amount: money.optional(),
    fx_rate_used: z.coerce.number().optional(),
    lines: z.array(expenseLine).min(1),
  })
  .strict();

const transition = z
  .object({
    notes: z.string().max(1000).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();
const markPaid = z
  .object({
    payment_method: z.enum([
      "cash",
      "bank_transfer",
      "pos_card",
      "payslip_addition",
      "wallet",
    ]),
    payment_reference: z.string().max(120).optional(),
  })
  .strict();

const advanceRequest = z
  .object({
    purpose: z.string().min(1).max(500),
    category_id: z.string().uuid().optional(),
    requested_amount_ngn: z.coerce.number().positive(),
    requested_currency: z.string().max(4).optional(),
    requested_amount_currency: z.coerce.number().positive().optional(),
    settle_by: z.string().date().optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();
const advanceApprove = z
  .object({
    approved_amount_ngn: z.coerce.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();
const advanceReject = z
  .object({ reason: z.string().max(500).optional() })
  .strict();
const advanceDisburse = z
  .object({
    disbursement_method: z.enum([
      "cash",
      "bank_transfer",
      "pos_card",
      "wallet",
    ]),
    disbursement_reference: z.string().max(120).optional(),
  })
  .strict();
const advanceSettle = z
  .object({
    expense_id: z.string().uuid().optional(),
    amount_settled_ngn: z.coerce.number().positive(),
    change_returned_ngn: money.optional(),
    shortfall_ngn: money.optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();
const receiptMeta = z
  .object({
    expense_line_id: z.string().uuid().optional(),
    amount_on_receipt_ngn: money.optional(),
    receipt_date: z.string().date().optional(),
    vendor_name: z.string().max(200).optional(),
  })
  .strict();

const mw = (s) => (req, _res, next) => {
  req.body = s.parse(req.body ?? {});
  next();
};

module.exports = {
  validateCategoryCreate: mw(categoryCreate),
  validateCategoryUpdate: mw(categoryCreate.partial()),
  validateExpenseCreate: mw(expenseCreate),
  validateTransition: mw(transition),
  validateMarkPaid: mw(markPaid),
  validateAdvanceRequest: mw(advanceRequest),
  validateAdvanceApprove: mw(advanceApprove),
  validateAdvanceReject: mw(advanceReject),
  validateAdvanceDisburse: mw(advanceDisburse),
  validateAdvanceSettle: mw(advanceSettle),
  validateReceiptMeta: mw(receiptMeta),
  categoryCreate,
  expenseCreate,
};
