/**
 * Documents & Signatures (V2.2 §6.13) — admin e-signature routes.
 * Mounted under the documents router at /api/v1/documents/signatures.
 * Permission key: documents.
 */

"use strict";

const express = require("express");
const controller = require("./documents.esign.controller");
const validator = require("./documents.esign.validator");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();
const can = (action) => requirePermission("documents", action);

router.get("/", can("view"), controller.list);
router.post(
  "/",
  can("create"),
  validator.validateRequestCreate,
  controller.create,
);
router.get("/:id", can("view"), controller.getById);
router.post("/:id/send", can("edit"), controller.send);
router.post("/:id/cancel", can("edit"), controller.cancel);
router.post(
  "/:id/void",
  can("delete"),
  validator.validateVoid,
  controller.voidRequest,
);
router.get("/:id/verify", can("view"), controller.verify);

module.exports = router;
