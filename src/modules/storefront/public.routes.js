/**
 * Public catalogue endpoints (no auth).
 * Storefront product browsing — no JWT required.
 */

"use strict";

const express = require("express");
const router = express.Router();

router.get("/products", (_req, res) => res.json({ data: [] }));
router.get("/products/:slug", (req, res) =>
  res.json({ data: { slug: req.params.slug } }),
);
router.get("/categories", (_req, res) => res.json({ data: [] }));
router.get("/collections/:slug", (req, res) =>
  res.json({ data: { slug: req.params.slug } }),
);
router.get("/content/:type/:slug", (req, res) =>
  res.json({ data: req.params }),
);

module.exports = router;
