/**
 * Messaging Smartcomm (V2.2 §6.17) — Zod validators.
 */

"use strict";

const { z } = require("zod");

const postMessage = z
  .object({
    content: z.string().min(1).max(8000),
    message_type: z
      .enum(["text", "image", "document", "voice_note", "video", "sticker"])
      .optional(),
    reply_to_id: z.string().uuid().optional(),
  })
  .strict();

const sendToCustomer = z
  .object({
    contact_id: z.string().uuid(),
    channel: z.enum(["whatsapp", "email"]).optional(),
    subject: z.string().max(200).optional(),
    body: z.string().min(1).max(8000),
  })
  .strict();

const mk = (schema) => (req, _res, next) => {
  req.body = schema.parse(req.body || {});
  next();
};

module.exports = {
  validatePostMessage: mk(postMessage),
  validateSendToCustomer: mk(sendToCustomer),
};
