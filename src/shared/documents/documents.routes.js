/**
 * Documents (V2.2 §6.13) — routes. Mounted at /api/v1/documents.
 * Permission key: documents. Uploads are multipart (memory storage → buffer
 * → documents.service.store → storage + shared.documents row).
 */

"use strict";

const express = require("express");
const multer = require("multer");
const c = require("./documents.controller");
const v = require("./documents.validator");
const esignRoutes = require("./documents.esign.routes");
const { config } = require("../../config/env");
const { requirePermission } = require("../../middleware/rbac");

const router = express.Router();
const can = (a) => requirePermission("documents", a);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MEDIA_MAX_FILE_SIZE_MB * 1024 * 1024 },
});

router.get("/", can("view"), c.list);
router.post(
  "/",
  can("create"),
  upload.single("file"),
  v.validateUploadMeta,
  c.upload,
);
// E-signatures — declared before "/:id" so the sub-router isn't shadowed.
router.use("/signatures", esignRoutes);
router.get("/:id", can("view"), c.getById);
router.get("/:id/download", can("view"), c.download);
router.delete("/:id", can("delete"), c.remove);

module.exports = router;
