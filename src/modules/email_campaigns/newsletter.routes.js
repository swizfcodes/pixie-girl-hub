/**
 * Public newsletter signup (V2.2 §6.16). No auth. Brand from X-Brand-Context
 * header / ?brand. A signup becomes a CRM contact (source='website') so it
 * flows into segments, campaigns and the rest of the system — not an isolated
 * list. POST /api/public/newsletter
 */

"use strict";

const express = require("express");
const controller = require("./email-campaigns.controller");
const validator = require("./email-campaigns.validator");

const router = express.Router();

router.post("/", validator.validateNewsletter, controller.subscribeNewsletter);

module.exports = router;
