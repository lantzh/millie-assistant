# Millie Build Plan — Working Prompt for Claude Code

You are helping me build features into Millie, my personal AI assistant project. Read this whole document before doing anything. It defines how we work together, the order we build in, and what to do first.

## Who I am and how I want to work

- I'm an experienced software engineer (20+ years, full-stack and front-end, TypeScript/Node, React/Next). I am newer to AI and agent concepts. When you introduce an AI-specific term (agent, RAG, embeddings, knowledge graph, eval, fine-tuning, etc.), define it in one plain sentence the first time it comes up. You do **not** need to explain general software concepts to me.
- We build **one step at a time**, in the ranked order below. Do not start a step until I say go. Never skip ahead, and never bundle two steps together.
- For every step, follow the **Per-Step Protocol** below, exactly.
- Keep changes small and reviewable. Prefer several small commits over one big one. After each change, tell me what you changed and why.
- Match the existing code style and conventions. I favor functional/procedural composition with small components over heavy class-based OOP — don't introduce OOP patterns unless there's a clear reason, and flag it if you do.
- When something is ambiguous, ask me instead of assuming. When a step needs a new dependency, name it, say what it's for, and wait for my OK before installing it.
- Don't refactor or "tidy" unrelated code without asking first.

## Per-Step Protocol (follow this for every step)

1. **Explain first.** Before writing any code: describe what this step accomplishes, the concepts involved (define new AI terms plainly), the approach you'll take, and the files you expect to create or change.
2. **Wait for my go-ahead.** Stop and let me ask questions or adjust. Do not write code until I confirm.
3. **Implement in small pieces.** Make focused changes and narrate what each one does as you go.
4. **Show me how to verify.** When the step is done, summarize what changed, how to run it, and exactly what I should see or test to confirm it works.
5. **Pause.** Wait for me to confirm it works and tell you to proceed before starting the next step.

## Project context (verify against the actual repo — don't trust this blindly)

Millie is a personal AI assistant aimed at elderly users.

- **Frontend:** Next.js with shadcn/ui.
- **Backend:** Node.js with a custom LangChain wrapper; LLM inference via Groq.
- **Memory:** PostgreSQL with the pgvector extension, used for semantic memory.
- **Iris:** a separate MCP server (TypeScript/Node, deployed on Railway) that already exposes real-world action tools (for example, `send_email`). Millie will increasingly use Iris as its tool/action gateway.

Treat the above as my recollection, not ground truth. In Step 0 you will read the code and confirm what is actually there.

## Step 0 — Orient (do this first, before any feature work)

Read through the Millie codebase (and the Iris codebase if it's available to you). Then give me a short summary of the current architecture as it **actually exists**:

- the main modules and how they fit together,
- how a chat message currently flows from the frontend to the LLM and back,
- how memory is read and written today,
- how tools are called today, if at all.

Flag anything that contradicts the context above. Do **not** change any code in this step. End by confirming we're aligned before we start Step 1.

## The ranked build plan

Each numbered item is a single step. We'll expand it together when we get there, following the Per-Step Protocol. The order is deliberate: each step builds on the one before it.

### 1. Restructure Millie's control flow as an explicit graph (LangGraph)

No new features in this step. Take the existing "receive message → maybe call tools → respond" loop and re-express it as a graph of named steps (nodes) connected by explicit transitions (edges), including any branching and looping. Goal: make the agent's flow visible and modifiable instead of buried in procedural code. This is the foundation the later steps lean on. If LangGraph turns out to be a poor fit for the current setup, explain why and propose the closest alternative before we commit to anything.

### 2. Add a live "reasoning" view

Have each graph node emit an event describing what it's doing (the plan it formed, which tool or retrieval it chose and why, what came back, the final synthesis). Stream those events to the frontend and render them as a collapsible, real-time timeline beside the chat, with a toggle to show or hide it. Goal: a window into what the agent is doing, useful both for debugging and for demos. This is why Step 1 comes first — the graph gives us clean points to emit those events.

### 3. Make memory explicit and typed

Alongside the existing semantic memory (pgvector), formalize two more layers: **working memory** (the short-term context for the current conversation) and **episodic memory** (a queryable log of past interactions and events, with timestamps). Goal: clear, named memory layers that the agent reads from and writes to deliberately, rather than one undifferentiated store.

### 4. Add knowledge-graph retrieval (GraphRAG)

Introduce a lightweight knowledge graph that stores facts as entities and the relationships between them, and add a retrieval path that can follow those relationships — used **alongside**, not replacing, the existing vector search. When we reach this step, propose the storage choice (a dedicated graph database such as Neo4j versus a graph modeled inside Postgres) with the tradeoffs of each. Goal: let the agent reason over connected facts, not just find similar text.

### 5. Build the "Request a feature" intake flow

Add a button and modal in Millie where a user submits a feature request. On submit, the backend calls a `create_ticket` action (route this through Iris as a new tool) that creates a ticket in the chosen tracker — default to a GitHub issue with a `triage` label. Then add a triage step: an LLM step that reads the raw request, fills in gaps, and rewrites it as a user story with acceptance criteria, then relabels the issue `ready`. Goal: turn a plain user request into a structured, build-ready ticket. This step is large, so when we reach it, break it into sub-steps and we'll do those one at a time as well.

### 6. Formalize Millie ↔ Iris as agent-to-agent (A2A)

Refactor the way Millie hands work to Iris into an explicit, documented agent-to-agent pattern rather than ad-hoc calls. Goal: a clean collaboration boundary between two agents, which is easier to reason about and to talk about.

### 7. Build an evaluation harness

Create a small test suite of representative tasks with expected outcomes, run them automatically, and report a success rate. Because agent behavior isn't deterministic, measure a success rate across runs rather than exact pass/fail, and make it easy to re-run after a prompt or tool change so we can catch regressions. Goal: a measurable way to tell whether a change makes Millie better or worse.

### Stretch (only if I ask for it, and only last)

### 8. Multi-provider support and a small local model

(a) Abstract LLM calls behind a single interface so we can route to providers other than Groq. (b) As a deliberately time-boxed experiment, fine-tune a small language model (using LoRA, a cheap fine-tuning method) on a small domain dataset and run it locally with Ollama or llama.cpp. Goal: a basic "runs at the edge / supports multiple providers" capability, kept small on purpose.

## Start now

Begin with **Step 0 only**. Read the code, summarize the current architecture as it actually exists, flag anything that doesn't match the context section, and then wait for me to confirm before we touch Step 1.
