/**
 * Invoicing & Billing (V2.2 §6.5) — Zod validators.
 */

"use strict";

const { z } = require("zod");
const money = z.coerce.number().nonnegative();

const invoiceLine = z
  .object({
    description: z.string().min(1).max(500),
    product_id: z.string().uuid().optional(),
    variant_id: z.string().uuid().optional(),
    sku_snapshot: z.string().max(80).optional(),
    quantity: z.coerce.number().positive(),
    unit_price_ngn: money,
    line_discount_ngn: money.optional(),
    tax_rate: z.coerce.number().min(0).max(1).optional(),
    revenue_account_code: z.string().max(20).optional(),
  })
  .strict();

const invoiceCreate = z
  .object({
    contact_id: z.string().uuid(),
    order_id: z.string().uuid().optional(),
    lines: z.array(invoiceLine).min(1),
    due_date: z.string().date(),
    issue_date: z.string().date().optional(),
    payment_terms: z.string().max(120).optional(),
    shipping_fee_ngn: money.optional(),
    wht_rate: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();

const invoiceSend = z
  .object({
    sent_via: z
      .enum(["whatsapp", "email", "instagram_dm", "print", "sms"])
      .optional(),
  })
  .strict();

const paymentApply = z
  .object({
    amount_applied_ngn: z.coerce.number().positive(),
    sales_order_payment_id: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  })
  .strict();

const creditNoteLine = z
  .object({
    description: z.string().min(1).max(500),
    source_invoice_line_id: z.string().uuid().optional(),
    quantity: z.coerce.number().positive(),
    unit_price_ngn: money,
    tax_rate: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();
const creditNoteCreate = z
  .object({
    invoice_id: z.string().uuid(),
    reason: z.string().min(1).max(500),
    reason_category: z
      .enum([
        "return",
        "damage",
        "price_correction",
        "customer_dispute",
        "duplicate_invoice",
        "goodwill",
        "other",
      ])
      .optional(),
    cancellation_request_id: z.string().uuid().optional(),
    lines: z.array(creditNoteLine).min(1),
  })
  .strict();

const receiptIssue = z
  .object({
    invoice_id: z.string().uuid().optional(),
    payment_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    amount_ngn: z.coerce.number().positive(),
    payment_method: z.string().min(1).max(40),
    notes: z.string().max(500).optional(),
  })
  .strict();

const mw = (s) => (req, _res, next) => {
  req.body = s.parse(req.body ?? {});
  next();
};

module.exports = {
  validateInvoiceCreate: mw(invoiceCreate),
  validateInvoiceSend: mw(invoiceSend),
  validatePaymentApply: mw(paymentApply),
  validateCreditNoteCreate: mw(creditNoteCreate),
  validateReceiptIssue: mw(receiptIssue),
  invoiceCreate,
  paymentApply,
};
