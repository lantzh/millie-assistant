# Millie - Elderly Care AI Assistant

## Project Overview

Millie is an AI chat assistant designed for elderly users, built as a portfolio piece demonstrating modern full-stack development and AI integration patterns.

**Current Goal:** Pare down to a polished, demonstrable portfolio piece rather than a production-ready application. Focus on showcasing skills, not building every feature.

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
- LangChain (for agentic AI patterns)
- Custom CloudflareLLM wrapper (extends LangChain's LLM base class)
- Cloudflare Workers AI (free Llama model hosting via REST API)

### Database

- PostgreSQL with pgvector extension
- Drizzle ORM
- Docker Compose for local development

## Architecture

```
millie/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server + API endpoints
│   │   ├── db/
│   │   │   ├── index.ts          # Drizzle connection
│   │   │   ├── schema.ts         # Tables: users, conversations, memory_snapshots
│   │   │   ├── memory.ts         # Functional memory helpers
│   │   │   └── DatabaseMemory.ts # Custom LangChain BaseMemory implementation
│   │   ├── llms/
│   │   │   └── CloudflareLLM.ts  # Custom LangChain LLM wrapper
│   │   └── prompts/
│   │       └── millie.ts         # PromptTemplate with Millie's personality
│   └── drizzle.config.ts
├── frontend/
│   └── src/app/
│       └── page.tsx              # Chat interface
├── docker-compose.yml
├── init-db.sql                   # Enables pgvector extension
└── .env                          # DB_URL, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
```

## What's Already Built

- ✅ Chat interface with shadcn/ui (Stone theme, message bubbles, avatars, auto-scroll)
- ✅ Cloudflare AI integration via custom LangChain LLM wrapper
- ✅ PostgreSQL + pgvector running in Docker
- ✅ Drizzle ORM with schema and migrations
- ✅ Persistent conversation memory (custom DatabaseMemory class plugs into LangChain's ConversationChain)
- ✅ Custom prompt template for Millie's personality
- ✅ Entity extraction (per user note — verify current state)

## Portfolio Scope — What to Focus On

**Keep it tight. Pick 2-3 of these to polish, not all of them:**

1. **Polish the existing chat experience** — make what's there feel finished (empty states, error handling, loading states, mobile responsiveness)
2. **Showcase the memory system** — add a simple UI panel showing what Millie "remembers" about the user (extracted entities, recent topics). This makes the AI work visible to portfolio reviewers.
3. **One agentic feature** — pick ONE tool/capability to demonstrate agentic patterns (e.g., medication reminders, a simple MCP server, or weather lookup). Don't build Plaid integration — too much auth/compliance overhead for a portfolio.
4. **Deploy somewhere** — even just Railway or Fly.io. A live demo URL is worth more than any feature.

## What to Explicitly Cut

- ❌ User authentication (use a hardcoded `default_user` — reviewers don't care)
- ❌ Plaid/banking integration (too much compliance surface area)
- ❌ Multi-cloud Terraform (overkill for a portfolio piece; one deployment is plenty)
- ❌ Production-grade error handling, rate limiting, monitoring

## Running Locally

```bash
# Start database
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

## Environment Variables (.env at project root)

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=millie_db
DB_USER=postgres
DB_PASSWORD=password
DB_URL=postgresql://postgres:password@localhost:5432/millie_db

CLOUDFLARE_ACCOUNT_ID=<your_account_id>
CLOUDFLARE_API_TOKEN=<your_api_token>
```

## Known Gotchas (from previous work)

- `dotenv.config()` must run before any DB imports — `db/index.ts` loads it defensively with path resolution back to project root
- The Cloudflare `@cloudflare/ai` SDK is for Workers runtime, NOT Node — use REST API directly (already handled in CloudflareLLM.ts)
- `pgvector` extension must be enabled in the specific database, not just installed — `init-db.sql` handles this on first container startup
- Init scripts in `/docker-entrypoint-initdb.d/` only run when the Postgres data volume is fresh. If vector extension is missing, `docker-compose down -v` and restart.
- Model name on Cloudflare matters — 404s usually mean wrong model string, not auth issues

## Current Model

Using a Cloudflare-hosted model (last used: Llama 3.1 8B Chat or Gemma — verify in `CloudflareLLM.ts`). Token limit set to 250 to avoid mid-sentence cutoffs.

## Restart Checklist

1. Pull the repo, check what state the code is in
2. Run `docker-compose up -d` and verify database comes up
3. Check `.env` has all required keys (Cloudflare token may need refresh)
4. Run both dev servers, send a test message, confirm memory persists across backend restart
5. Look at the `conversations` table in DBeaver to see what history is there
6. Decide which 2-3 portfolio items to tackle — don't scope-creep back into production mode

## Learning Goals (original)

Agentic AI, LangChain, MCP, Terraform deployment. For portfolio purposes, LangChain + one agentic capability + a deployment is enough to demonstrate all four.
