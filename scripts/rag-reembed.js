#!/usr/bin/env node
/**
 * Re-embed all shared.ai_embeddings rows under a new model/version.
 * Used when migrating embedding models (V2.2 §8.1 — "store source text
 * so anything can be re-embedded at any time").
 *
 *   node scripts/rag-reembed.js --model text-embedding-3-large --version 2
 */

"use strict";

console.log("TODO: re-embed all source_text rows under new model");
