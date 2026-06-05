/**
 * Praxis Orchestrator (V2.2 §8.2 — multi-agent architecture).
 *
 * Pipeline:
 *   1. Input → intent classify
 *   2. RAG retrieve (permission-scoped)
 *   3. Plan (decompose into steps)
 *   4. Per step: match action → fill payload → confirm → execute → verify + log
 *   5. Assemble reply
 *
 * Safety:
 *   - Every WRITE action goes into ai_pending_actions and waits for explicit confirmation
 *   - Low-confidence intent matches halt and ask (no guessing)
 *   - Permission + entity checked server-side per call
 */

"use strict";

// const catalogue = require('./action-catalogue');
// const rag = require('./rag-pipeline');

async function handle({
  user: _user,
  brand: _brand,
  message_text: _message,
  conversation_id: _convId,
}) {
  // 1. Intent classify (LLM call)
  // 2. RAG retrieve
  // 3. Plan
  // 4. Per step: confirm-then-execute
  // 5. Assemble reply
  throw new Error("TODO: implement Praxis orchestrator");
}

module.exports = { handle };
