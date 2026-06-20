# Millie — Elderly Care AI Assistant

## Project Overview

Millie is an AI chat assistant designed for elderly users. It uses a multi-node LangGraph agent with persistent memory, semantic search, entity extraction, and a knowledge graph. It communicates with an external tool server (Iris) via MCP to send email and SMS.

## Tech Stack

### Frontend
- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS
- shadcn/ui components (Stone theme)
- Lucide React icons

### Backend
- Node.js + Express
- TypeScript
- LangGraph (`@langchain/langgraph`) — StateGraph with 4 nodes
- Groq API (`llama-3.3-70b-versatile`) — main chat LLM, called directly via fetch
- GroqLLM (custom LangChain wrapper) — used only for entity extraction (needs `llm.invoke()` interface)
- `@huggingface/transformers` — local ONNX embedding model, no external API call
- PostgreSQL with pgvector extension
- Drizzle ORM

### External Services
- **Iris** — MCP tool server (deployed on Railway), provides `send_email` and `send_sms` tools
- **Groq** — LLM API (blocked by VPN — turn off VPN if you get 403 errors)

## Architecture

```
millie/
├── backend/
│   ├── src/
│   │   ├── index.ts                  # Express server, SSE streaming, /api/chat endpoint
│   │   ├── agent/
│   │   │   ├── state.ts              # AgentState, Message, PipelineEvent types + StateAnnotation
│   │   │   ├── graph.ts              # LangGraph StateGraph wiring + conditional edges
│   │   │   └── nodes.ts              # loadContext, callLlm, executeTools, saveAndRespond
│   │   ├── db/
│   │   │   ├── index.ts              # Drizzle connection (loads .env)
│   │   │   ├── schema.ts             # Tables: conversations, entities, entity_relationships, memory_snapshots, users
│   │   │   ├── memory.ts             # saveConversation, getRecentHistory, getEntityFacts
│   │   │   ├── embeddings.ts         # Local bge-small-en-v1.5 model, generateEmbedding, storeEmbedding, findSimilarConversations
│   │   │   └── graph.ts              # populateGraph, getGraphContext (knowledge graph)
│   │   ├── llms/
│   │   │   └── GroqLLM.ts            # LangChain LLM wrapper for Groq
│   │   ├── services/
│   │   │   ├── irisClient.ts         # MCP client — getIrisTools, callIrisTool
│   │   │   └── entityExtractor.ts    # extractEntities (calls GroqLLM, returns 20-category JSON)
│   │   └── prompts/
│   │       └── entityExtraction.ts   # Prompt template for entity extraction
│   ├── drizzle/                      # Migration SQL files
│   └── drizzle.config.ts
├── frontend/
│   └── src/app/
│       └── page.tsx                  # Chat UI + reasoning panel (log view + graph view)
├── docker-compose.yml                # Local Postgres with pgvector
├── init-db.sql                       # Enables pgvector extension on first container start
└── .env                              # DB_URL, GROQ_API_KEY, IRIS_URL
```

## Agent Graph (LangGraph)

```
START → loadContext → callLlm → [tool_calls?]
                                 ├─ yes → executeTools → [error?]
                                 │                        ├─ yes → saveAndRespond
                                 │                        └─ no  → callLlm (loop)
                                 └─ no  → saveAndRespond → END
```

## Per-Message Pipeline (what happens on every message)

**loadContext:**
1. Recent history (last 5 turns from DB)
2. Knowledge graph context (entities + relationships)
3. Entity facts fallback (flat JSONB aggregation if graph is empty)
4. Semantic search (embed user message, find 3 similar past conversations)
5. Fetch tools from Iris via MCP
6. Emit pipeline log events for each step

**callLlm:** Groq API call with full message history + tools

**executeTools (if needed):** Call Iris MCP tool, set toolError on failure

**saveAndRespond:**
1. Extract entities (second Groq call via GroqLLM)
2. Insert conversation row to DB
3. Generate + store embedding (local ONNX model)
4. Populate knowledge graph (upsert entities + relationships)
5. Emit pipeline log events for each step

## Memory System (3 layers)

| Layer | What | How retrieved |
|-------|------|---------------|
| Recent history | Last 5 raw turns | Injected verbatim into system prompt |
| Knowledge graph | Entities (people, meds, conditions) + TREATS relationships | `getGraphContext` — SQL query on `entities` + `entity_relationships` tables |
| Semantic search | Past conversations similar to current message | Cosine similarity (`<=>`) on `message_embedding` vector column |

## SSE Streaming

`/api/chat` streams two event types:
- `reasoning` — one per LangGraph node (label + detail + optional route for graph viz)
- `pipeline` — sub-events from `loadContext` and `saveAndRespond` (stage, status, detail)
- `response` — final text after graph completes
- `error` — on unhandled failure

Frontend renders pipeline events as indented sub-rows in the reasoning log with stage icons (📜🕸️🔍🔧🏷️📐).

## Environment Variables (.env at project root)

```
DB_URL=postgresql://...
GROQ_API_KEY=gsk_...
IRIS_URL=https://iris-production-c66e.up.railway.app/mcp
PORT=3001
```

## Running Locally

```bash
# Start database (if running locally via Docker)
docker-compose up -d

# Backend (terminal 1)
cd backend
npm install
npm run db:migrate
npm run dev

# Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

## Database Migrations

```bash
cd backend
npm run db:generate   # generate migration from schema changes
npm run db:migrate    # apply migrations
```

## Known Gotchas

- **VPN blocks Groq** — Groq returns 403 "Access denied. Please check your network settings." Turn off VPN.
- **pgvector must be enabled per-database** — `init-db.sql` handles this on first Docker container start. If the vector extension is missing: `docker-compose down -v` and restart.
- **Init scripts only run on fresh volume** — if you see pgvector errors after an existing setup, the init script didn't re-run.
- **dotenv must load before DB imports** — `db/index.ts` loads it defensively with path resolution back to project root.
- **LLaMA 3.x leaks function-call syntax** — `llama-3.3-70b-versatile` sometimes puts `<function=NAME[]ARGS</function>` in the content field instead of (or alongside) structured `tool_calls`. Handled in `callGroq` via `parseLeakedFunctionSyntax`.
- **Iris URL must be the Railway URL** — `IRIS_URL=http://localhost:3000/mcp` causes silent failures where tools appear unavailable.
- **Embedding model downloads on first run** — `bge-small-en-v1.5` is downloaded from HuggingFace on first `warmupEmbedder()` call. Subsequent runs use the cache.
- **Entity extraction is a second LLM call** — adds latency to `saveAndRespond`. If Groq is slow, the SSE stream stays open longer before closing.

## Build Plan Progress

- ✅ Step 0 — Project setup, DB, basic chat
- ✅ Step 1 — LangGraph agent (refactor from procedural to graph)
- ✅ Step 2 — Frontend reasoning panel (SSE streaming, log + graph views)
- ✅ Step 3 — Embedding + semantic memory
- ✅ Step 4 — Entity extraction + knowledge graph (GraphRAG)
- 🔲 Step 5 — Feature request intake flow (GitHub issues via Iris)
- 🔲 Step 6 — A2A Millie↔Iris formalization
- 🔲 Step 7 — Evaluation harness
- 🔲 Step 8 — Multi-provider / local model (stretch)

## Restart Checklist

1. Check `.env` has `DB_URL`, `GROQ_API_KEY`, `IRIS_URL`
2. Start Postgres (`docker-compose up -d`) if running locally
3. `cd backend && npm run db:migrate`
4. Run both dev servers
5. Turn off VPN before testing
6. Send a test message — check reasoning panel shows pipeline events
7. Check `entities` table in DB to confirm knowledge graph is populating
