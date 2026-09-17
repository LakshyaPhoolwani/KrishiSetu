# AI Agent

Phase 8 adds a backend-only conversational foundation at
`POST /api/ai/chat`. The agent explains verified KrishiSetu tool results; it
is not a source of truth and cannot directly access Prisma, change records, or
authorize a user.

## Configuration

Set backend-only environment variables:

```text
GEMINI_API_KEY=
GEMINI_MODEL=
```

The backend uses Google's official `@google/genai` SDK. The configured model
defaults to `gemini-2.0-flash` when `GEMINI_MODEL` is empty. The API key is
never sent to web/mobile clients or logged. No live Gemini verification is
claimed without credentials.

## Tools and authorization

Only these tools are registered:

- `get_farmer_lots`: FARMER-only, scoped to the authenticated Farmer
- `get_market_prices`: authenticated read of existing trusted market prices
- `get_buyer_matches`: FARMER-only, scoped to an owned Lot and existing
  deterministic matching logic
- `calculate_net_realisation`: FARMER-only, scoped to an owned Lot and
  existing Decimal-safe Net Realisation logic

Tool arguments are parsed with strict Zod schemas. Unknown tools, malformed
JSON, invalid IDs, unauthorized roles, and cross-owner resources fail safely.
The LLM cannot provide farmer identity, override MarketPrice, or submit
derived financial values. Calculation cost inputs are explicit and required;
the agent never silently assumes zero.

Market-price results retain `source`, `sourceType`, `priceDate`,
`normalizedUnit`, and `fetchedAt`, so DEMO data can never be described as
verified LIVE data. The system prompt requires tool-first factual answers,
no invented prices/buyers/lots, no independent financial arithmetic, no
unsupported guarantees, and no claims of sales or acceptance.

## API behavior and limits

Chat requests contain `message` and optional `conversationId`. Conversation
history is not persisted in Phase 8; the ID is returned for future
integration. The agent permits at most three tool iterations, truncates final
responses to 6,000 characters, and limits each authenticated user to ten
requests per minute in the process. Gemini/provider failures return safe
application errors without exposing provider details.

Prompt injection is treated as untrusted user content. Authorization is
enforced before every tool operation and never delegated to model text.
There is no automatic selling, matching mutation, offer, transaction, payment,
voice, WhatsApp, or frontend integration.
