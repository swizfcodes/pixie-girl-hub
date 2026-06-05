# Praxis AI Architecture

V2.2 §6.29-6.31 + §8.1-8.5

## What Praxis is

A conversational agent the CEO can talk to (text or voice) to query the business or execute actions. Backed by DeepSeek for general intelligence, with strong guardrails:

- Can only execute actions from the **Action Catalogue**
- Every WRITE requires **explicit confirmation** before execution
- Acts with the **user's own permissions** — never elevates
- Logs every action to `shared.audit_log`

## The thin-server principle (§8.1)

All heavy compute is API-based:

- **LLM:** DeepSeek API
- **Transcription:** Groq Whisper API
- **Embeddings:** OpenAI text-embedding-3-small API
- **Vector store:** pgvector inside PostgreSQL (no separate vector DB)
- **Orchestration:** lightweight Node.js (no LangChain dependency lock-in)

No GPU. No large server. The backend stays small.

## Action Catalogue (§8.3)

The Action Catalogue (`shared.ai_action_catalogue`) is the grounding mechanism that prevents hallucination. It's built by scanning the OpenAPI spec (`scripts/build-action-catalogue.js`) and listing every real endpoint with:

- `action_key` (`invoice.create`, `stock.transfer.initiate`)
- `title`, `description` (plain language)
- `http_method`, `route` (real endpoint)
- `payload_schema` (JSON Schema for inputs)
- `required_permission` (the RBAC grant needed)
- `entity_scope` (pixiegirl | faitlynhair | both)
- `is_write` (forces confirmation)
- `ai_enabled` (manual toggle by CEO)
- `examples` (sample utterances — embedded for retrieval)

New routes appear as `ai_enabled = false` until a human reviews and enables them. **Praxis cannot construct an endpoint that isn't in the catalogue.**

## RAG (§8.4)

Embeddings live in `shared.ai_embeddings`:

- `embedding` (vector(1536))
- `source_text` (the original text — kept for re-embedding)
- `embedding_model`, `embedding_version` (so we can migrate models)
- `entity_scope` (which brand owns this content)
- `access_scope` (which roles can see this content)

Retrieval flow:

```
user query
  ↓
embed
  ↓
similarity search filtered by:
  - entity_scope ⊆ user's available_businesses
  - access_scope ⊆ user's permissions
  ↓
top-k chunks → prompt
  ↓
LLM
```

This is what stops PII / cost prices / other-brand data from leaking into the model context.

## Orchestrator (§8.2)

The multi-agent pipeline:

```
1. Input              text or Whisper transcript
2. Intent classify    LLM call against summary of catalogue
3. RAG retrieve       permission-scoped similarity
4. Plan               decompose into ordered steps
5. Per step:
   a. Match action    from catalogue (top candidates by similarity)
   b. Fill payload    ask user for missing required fields
   c. Confirm         show exact action + payload, wait for explicit "Yes"
   d. Execute         call the real endpoint with user's auth
   e. Verify + log    audit_log entry
   f. Carry result    forward to next step if needed
6. Assemble reply     summarise + provide links to created records
```

For writes, the confirm step persists the proposed action to `shared.ai_pending_actions`. The frontend shows a card; the user clicks Confirm; the action executes. A cron sweeps stale unconfirmed actions every 15 minutes.

## Usage metering (§6.31)

Every AI call MUST go through `src/ai/usage-meter.js`:

- Pre-check: feature enabled? under hard cap?
- Make call
- Post: write to `shared.ai_usage_ledger`, broadcast new total on `system:ai_usage_meter`

Budgets are per calendar month, with **soft** and **hard** caps. Soft cap → notification to CEO. Hard cap → AI pauses gracefully; deterministic Tier-1 insights keep running.

## Tier-1 vs Tier-2 insights (§6.30)

- **Tier 1 — deterministic** (always on, zero AI cost): SQL rules against module data. E.g., stock under reorder point, margin under floor, invoice overdue, off-site clock-in.
- **Tier 2 — AI narration** (scheduled, low cost): once a day, DeepSeek reads the SUMMARISED Tier-1 findings (not raw data) and writes the CEO a plain-language briefing.

When the AI budget hard-caps, Tier 2 pauses. Tier 1 keeps running. Insights cards on the dashboard never go blank.
