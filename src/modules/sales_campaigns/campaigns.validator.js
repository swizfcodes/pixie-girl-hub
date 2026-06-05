/**
 * Sales Campaigns & Landing Pages (V2.2 §6.22)
 * Input validators — Zod schemas wrapped in Express middleware.
 *
 * Validation failures throw ZodError → the central error handler turns
 * them into 400 VALIDATION_ERROR with a `fields` map.
 */

"use strict";

const { z } = require("zod");

const isoDateTime = z.string().datetime({ offset: true });
const slug = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case (a-z, 0-9, -)");
const moneyNgn = z.coerce.number().nonnegative();

const discountTypes = [
  "percentage",
  "fixed_amount",
  "buy_x_get_y",
  "bundle",
  "free_shipping",
];
const productScopes = ["all", "specific_products", "specific_categories"];
const notifyVia = ["email", "whatsapp", "sms", "both"];

const landingBlock = z
  .object({
    type: z.string(),
    title: z.string().optional(),
    body: z.string().optional(),
    items: z.array(z.any()).optional(),
  })
  .passthrough();

const createSchema = z
  .object({
    name: z.string().min(1).max(200),
    slug,
    description: z.string().max(2000).optional(),
    starts_at: isoDateTime,
    ends_at: isoDateTime,
    discount_type: z.enum(discountTypes),
    discount_value: z.coerce.number().positive(),
    min_order_value_ngn: moneyNgn.optional(),
    customer_segment_id: z.string().uuid().optional(),
    first_time_buyers_only: z.boolean().optional().default(false),
    product_scope: z.enum(productScopes).optional().default("all"),
    landing_hero_title: z.string().max(300).optional(),
    landing_hero_subtitle: z.string().max(500).optional(),
    landing_hero_image_url: z.string().url().optional(),
    landing_cta_text: z.string().max(80).optional(),
    landing_blocks: z.array(landingBlock).optional(),
    countdown_message: z.string().max(200).optional(),
    signup_for_notifications: z.boolean().optional(),
    ended_message: z.string().max(300).optional(),
    ended_redirect_to: z.string().max(500).optional(),
    meta_title: z.string().max(200).optional(),
    meta_description: z.string().max(500).optional(),
    og_image_url: z.string().url().optional(),
    total_usage_limit: z.coerce.number().int().positive().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (new Date(val.ends_at) <= new Date(val.starts_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ends_at"],
        message: "ends_at must be after starts_at",
      });
    }
    if (val.discount_type === "percentage" && val.discount_value > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["discount_value"],
        message:
          "percentage discount_value must be a fraction (e.g. 0.20 for 20%)",
      });
    }
  });

// Update: same fields, all optional; status changes go through transitions.
const updateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: slug.optional(),
    description: z.string().max(2000).nullable().optional(),
    starts_at: isoDateTime.optional(),
    ends_at: isoDateTime.optional(),
    discount_type: z.enum(discountTypes).optional(),
    discount_value: z.coerce.number().positive().optional(),
    min_order_value_ngn: moneyNgn.nullable().optional(),
    customer_segment_id: z.string().uuid().nullable().optional(),
    first_time_buyers_only: z.boolean().optional(),
    product_scope: z.enum(productScopes).optional(),
    landing_hero_title: z.string().max(300).nullable().optional(),
    landing_hero_subtitle: z.string().max(500).nullable().optional(),
    landing_hero_image_url: z.string().url().nullable().optional(),
    landing_cta_text: z.string().max(80).nullable().optional(),
    landing_blocks: z.array(landingBlock).optional(),
    countdown_message: z.string().max(200).nullable().optional(),
    signup_for_notifications: z.boolean().optional(),
    ended_message: z.string().max(300).nullable().optional(),
    ended_redirect_to: z.string().max(500).nullable().optional(),
    meta_title: z.string().max(200).nullable().optional(),
    meta_description: z.string().max(500).nullable().optional(),
    og_image_url: z.string().url().nullable().optional(),
    total_usage_limit: z.coerce.number().int().positive().nullable().optional(),
  })
  .strict();

const addProductSchema = z
  .object({
    product_id: z.string().uuid().optional(),
    category_id: z.string().uuid().optional(),
    include_exclude: z.enum(["include", "exclude"]),
    campaign_price_ngn: moneyNgn.optional(),
    display_order: z.coerce.number().int().min(0).optional(),
    is_featured: z.boolean().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!!val.product_id === !!val.category_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product_id"],
        message: "exactly one of product_id or category_id is required",
      });
    }
  });

const updateProductSchema = z
  .object({
    campaign_price_ngn: moneyNgn.nullable().optional(),
    display_order: z.coerce.number().int().min(0).optional(),
    is_featured: z.boolean().optional(),
    include_exclude: z.enum(["include", "exclude"]).optional(),
  })
  .strict();

const landingSchema = z
  .object({
    landing_hero_title: z.string().max(300).nullable().optional(),
    landing_hero_subtitle: z.string().max(500).nullable().optional(),
    landing_hero_image_url: z.string().url().nullable().optional(),
    landing_cta_text: z.string().max(80).nullable().optional(),
    landing_blocks: z.array(landingBlock).optional(),
    countdown_message: z.string().max(200).nullable().optional(),
    ended_message: z.string().max(300).nullable().optional(),
    ended_redirect_to: z.string().max(500).nullable().optional(),
    meta_title: z.string().max(200).nullable().optional(),
    meta_description: z.string().max(500).nullable().optional(),
    og_image_url: z.string().url().nullable().optional(),
  })
  .strict();

// Public — pre-launch notification signup.
const signupSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(7).max(20).optional(),
    notify_via: z.enum(notifyVia).optional().default("email"),
    source: z.string().max(60).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!val.email && !val.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "email or phone is required",
      });
    }
  });

const transitionSchema = z
  .object({ notes: z.string().max(1000).optional() })
  .strict();

const duplicateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    slug: slug.optional(),
  })
  .strict();

function mw(schema) {
  return function validate(req, _res, next) {
    req.body = schema.parse(req.body ?? {});
    next();
  };
}

module.exports = {
  validateCreate: mw(createSchema),
  validateUpdate: mw(updateSchema),
  validateAddProduct: mw(addProductSchema),
  validateUpdateProduct: mw(updateProductSchema),
  validateLanding: mw(landingSchema),
  validateSignup: mw(signupSchema),
  validateTransition: mw(transitionSchema),
  validateDuplicate: mw(duplicateSchema),
  createSchema,
  updateSchema,
  addProductSchema,
  signupSchema,
};
