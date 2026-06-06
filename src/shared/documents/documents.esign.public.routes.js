/**
 * Documents & Signatures (V2.2 §6.13) — public signing routes (no auth).
 * Mounted at /api/public/sign. External signers reach these via the
 * signed link emailed to them; the unguessable :token identifies the signer.
 */

"use strict";

const express = require("express");
const controller = require("./documents.esign.controller");
const validator = require("./documents.esign.validator");

const router = express.Router();

router.get("/:token", controller.viewByToken);
router.post("/:token/sign", validator.validateSign, controller.signByToken);
router.post(
  "/:token/decline",
  validator.validateDecline,
  controller.declineByToken,
);

module.exports = router;
