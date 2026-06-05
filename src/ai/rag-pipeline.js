/**
 * RAG retrieval pipeline (V2.2 §8.4).
 *
 *   query → embed → permission-scoped vector search → top-k chunks → prompt
 *
 * Embeddings are stored in shared.ai_embeddings with:
 *   - embedding (vector(1536))
 *   - source_text (the original text — keep for re-embedding)
 *   - embedding_model + embedding_version
 *   - scope tags (entity, access level, source_type)
 *
 * Permission-scoped retrieval is critical: every embedding row carries
 * the access scope of its source, and retrieval filters by the user's
 * permissions + active entity BEFORE similarity ranking.
 */

"use strict";

const { query } = require("../config/database");
const { logger } = require("../config/logger");

async function embedText(_text) {
  // TODO: call OpenAI text-embedding-3-small via service wrapper
  throw new Error("TODO: implement embed via OpenAI service");
}

async function retrieve({ user: _user, brand, queryText, topK = 5 }) {
  const queryVector = await embedText(queryText);

  // Permission/entity-scoped similarity search
  const { rows } = await query(
    `SELECT source_text, source_type, source_id,
            1 - (embedding <=> $1::vector) AS similarity
       FROM shared.ai_embeddings
      WHERE (entity_scope = 'both' OR entity_scope = $2)
        AND embedding_model = 'text-embedding-3-small'
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
    [queryVector, brand, topK],
  );

  logger.debug({ topK, hits: rows.length }, "RAG retrieval");
  return rows;
}

module.exports = { embedText, retrieve };
