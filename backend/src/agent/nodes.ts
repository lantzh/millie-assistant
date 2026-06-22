import { getRecentHistory, saveConversation, getEntityFacts } from "../db/memory";
import { generateEmbedding, findSimilarConversations, storeEmbedding, warmupEmbedder } from "../db/embeddings";
import { getGraphContext, populateGraph } from "../db/graph";
import { callIrisTool } from "../services/irisClient";
import { irisAgent } from "../services/irisAgent";
import { extractEntities } from "../services/entityExtractor";
import { GroqLLM } from "../llms/GroqLLM";
import { AgentState, Message, PipelineEvent } from "./state";

warmupEmbedder().catch(() => {});

const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT = `You are Millie, a caring and empathetic AI assistant designed specifically for elderly users.

Key traits:
- Speak warmly and patiently
- Use clear, simple language
- Show concern and care
- Be helpful with daily tasks and questions
- Remember what users tell you during the conversation
- Avoid using slang that may be unfamiliar to people born before 1960
- Always complete your thoughts. If giving advice, prioritize the most important points first
- You can send emails and SMS messages on behalf of the user when they ask
- Only call send_email or send_sms when the user EXPLICITLY asks you to send something right now. Phrases like "I need to email someone", "I was thinking of texting", or "there's someone I should contact" are NOT requests to send — they are conversation. Ask clarifying questions instead.
- If you attempted an action in a previous message and it failed, do NOT retry it automatically. Only try again if the user explicitly asks you to`;

const groqLlm = new GroqLLM({ apiKey: GROQ_API_KEY, maxTokens: 800, jsonMode: true });

function historyToMessages(history: string): Message[] {
  if (!history.trim()) return [];

  return history.split("\n").reduce((msgs: Message[], line) => {
    if (line.startsWith("Human: ")) {
      msgs.push({ role: "user", content: line.slice(7) });
    } else if (line.startsWith("Assistant: ")) {
      msgs.push({ role: "assistant", content: line.slice(11) });
    } else if (msgs.length > 0) {
      msgs[msgs.length - 1].content =
        (msgs[msgs.length - 1].content ?? "") + "\n" + line;
    }
    return msgs;
  }, []);
}

// LLaMA 3.x models sometimes leak their native function-call syntax into the
// content field: <function=NAME[]ARGS</function>. This parses that format into
// a proper ToolCall so the graph executes it normally.
function parseLeakedFunctionSyntax(content: string): Message["tool_calls"] | null {
  const match = content.match(/<function=(\w+)\[.*?\](\{[\s\S]*?\})<\/function>/);
  if (!match) return null;
  const [, name, argsStr] = match;
  try {
    JSON.parse(argsStr);
    return [{ id: `call_${Date.now()}`, type: "function", function: { name, arguments: argsStr } }];
  } catch {
    return null;
  }
}

async function callGroq(messages: Message[], tools?: unknown[]): Promise<Message> {
  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    max_tokens: 800,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = "auto";
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Groq API error: ${response.status} ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const msg = data.choices[0].message as Message;

  // If the model leaked function-call syntax into content without populating tool_calls,
  // parse it into proper tool_calls so the graph executes it correctly.
  if (msg.content?.includes("<function=") && !msg.tool_calls?.length) {
    const parsed = parseLeakedFunctionSyntax(msg.content);
    if (parsed) {
      msg.tool_calls = parsed;
      msg.content = null;
    }
  }
  // If tool_calls is populated, content containing leaked syntax is harmless noise — strip it.
  if (msg.tool_calls?.length && msg.content?.includes("<function=")) {
    msg.content = null;
  }

  return msg;
}

export async function loadContext(state: AgentState): Promise<Partial<AgentState>> {
  console.log("🔍 [loadContext] Loading history, memory, and tools");
  const pipelineLog: PipelineEvent[] = [];

  const [history, entityFacts, graphResult] = await Promise.all([
    getRecentHistory(state.userId, 5),
    getEntityFacts(state.userId),
    getGraphContext(state.userId),
  ]);

  // History log
  const historyMessages = historyToMessages(history);
  const turnCount = Math.floor(historyMessages.length / 2);
  pipelineLog.push({
    stage: "history",
    status: turnCount > 0 ? "done" : "skip",
    detail: turnCount > 0
      ? `${turnCount} recent turn${turnCount !== 1 ? "s" : ""} loaded`
      : "No conversation history yet",
  });

  // Knowledge graph log
  pipelineLog.push({
    stage: "graph",
    status: graphResult.entityCount > 0 ? "done" : "skip",
    detail: graphResult.entityCount > 0
      ? `${graphResult.entityCount} entit${graphResult.entityCount !== 1 ? "ies" : "y"} in graph`
      : "Knowledge graph is empty",
  });

  // Semantic retrieval
  let episodic: Array<{ message: string; response: string }> = [];
  try {
    const queryEmbedding = await generateEmbedding(state.userMessage);
    episodic = await findSimilarConversations(state.userId, queryEmbedding, 3);
  } catch (err) {
    console.warn("⚠️ [loadContext] Semantic retrieval skipped:", err instanceof Error ? err.message : err);
  }
  pipelineLog.push({
    stage: "semantic",
    status: episodic.length > 0 ? "done" : "skip",
    detail: episodic.length > 0
      ? `${episodic.length} similar past conversation${episodic.length !== 1 ? "s" : ""} found`
      : "No semantic matches yet",
  });

  // Build system prompt memory block
  const memoryParts: string[] = [];
  if (graphResult.text) {
    memoryParts.push(`What I know about you:\n${graphResult.text}`);
  } else if (entityFacts) {
    memoryParts.push(`What I know about you:\n${entityFacts}`);
  }
  if (episodic.length > 0) {
    const snippets = episodic
      .map((c) => `• "${c.message.slice(0, 100)}" → "${c.response.slice(0, 100)}"`)
      .join("\n");
    memoryParts.push(`Relevant past conversations:\n${snippets}`);
  }

  let systemContent = SYSTEM_PROMPT;
  if (memoryParts.length > 0) {
    systemContent += `\n\n---\n${memoryParts.join("\n\n")}\n---`;
  }

  // Load tools
  let tools: unknown[] = [];
  try {
    tools = await irisAgent.getTools();
  } catch (error) {
    console.warn("⚠️ [loadContext] Could not fetch Iris tools:", error instanceof Error ? error.message : error);
    systemContent += "\n\nNOTE: Your communication tools (email, SMS) are currently unavailable. If the user asks you to send a message, tell them honestly that you're unable to right now.";
  }

  // Tools log
  const toolNames = (tools as Array<{ function?: { name?: string } }>)
    .map((t) => t.function?.name ?? "?")
    .filter(Boolean);
  pipelineLog.push({
    stage: "tools",
    status: tools.length > 0 ? "done" : "error",
    detail: tools.length > 0
      ? `${tools.length} tool${tools.length !== 1 ? "s" : ""}: ${toolNames.join(", ")}`
      : "Tools unavailable",
  });

  const messages: Message[] = [
    { role: "system", content: systemContent },
    ...historyMessages,
    { role: "user", content: state.userMessage.trim() },
  ];

  return { messages, tools, pipelineLog };
}

export async function callLlm(state: AgentState): Promise<Partial<AgentState>> {
  console.log("🤖 [callLlm] Calling Groq");
  const assistantMessage = await callGroq(state.messages, state.tools);
  return { messages: [assistantMessage] };
}

export async function executeTools(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1];
  const toolResults: Message[] = [];
  let toolError: string | undefined;

  for (const toolCall of lastMessage.tool_calls!) {
    const toolArgs = JSON.parse(toolCall.function.arguments);
    console.log(`🔧 [executeTools] Calling Iris tool: ${toolCall.function.name}`, toolArgs);

    let content: string;
    try {
      content = await callIrisTool(toolCall.function.name, toolArgs);
      console.log(`✅ [executeTools] Result: ${content}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Tool call failed";
      content = `Error: ${reason}`;
      toolError = reason;
      console.error(`❌ [executeTools] ${content}`);
    }

    toolResults.push({ role: "tool", tool_call_id: toolCall.id, content });
  }

  return { messages: toolResults, toolError };
}

export async function saveAndRespond(state: AgentState): Promise<Partial<AgentState>> {
  console.log("💾 [saveAndRespond] Saving conversation");
  const pipelineLog: PipelineEvent[] = [];

  const responseText = state.toolError
    ? "I'm sorry, dear. I wasn't able to send that for you — there seems to be a problem with my email connection right now. I won't try again on my own, but just let me know if you'd like me to try once more."
    : (state.messages[state.messages.length - 1].content ?? "I'm sorry, I couldn't process that.");

  // 1. Extract entities
  let extractedEntities: unknown = null;
  try {
    const conversationText = `Human: ${state.userMessage}\nAssistant: ${responseText}`;
    extractedEntities = await extractEntities(conversationText, groqLlm);

    type EntitySummaryField = Array<{ name?: string; condition?: string; type?: string }>;
    const e = extractedEntities as Record<string, EntitySummaryField> | null;
    const highlights: string[] = [];
    if (e?.medications?.length)     highlights.push(`medications: ${e.medications.map((m) => m.name).filter(Boolean).join(", ")}`);
    if (e?.family_members?.length)  highlights.push(`family: ${e.family_members.map((f) => f.name).filter(Boolean).join(", ")}`);
    if (e?.health_conditions?.length) highlights.push(`conditions: ${e.health_conditions.map((c) => c.condition).filter(Boolean).join(", ")}`);
    if (e?.activities?.length)      highlights.push(`activities: ${e.activities.map((a) => a.type).filter(Boolean).join(", ")}`);

    pipelineLog.push({
      stage: "entities",
      status: highlights.length > 0 ? "done" : "skip",
      detail: highlights.length > 0 ? highlights.join(" · ") : "Nothing notable to extract",
    });
  } catch (err) {
    console.warn("⚠️ Entity extraction failed:", err instanceof Error ? err.message : err);
    pipelineLog.push({ stage: "entities", status: "error", detail: "Extraction failed" });
  }

  // 2. Save to DB
  const conversationId = await saveConversation(state.userId, state.userMessage, responseText, extractedEntities);

  // 3. Generate + store embedding
  try {
    const embedding = await generateEmbedding(state.userMessage);
    await storeEmbedding(conversationId, embedding);
    pipelineLog.push({ stage: "embedding", status: "done", detail: `${embedding.length}-dim vector stored` });
    console.log(`📐 Embedding stored for conversation ${conversationId}`);
  } catch (err) {
    console.warn("⚠️ Embedding failed:", err instanceof Error ? err.message : err);
    pipelineLog.push({ stage: "embedding", status: "error", detail: "Embedding generation failed" });
  }

  // 4. Populate knowledge graph
  if (extractedEntities) {
    try {
      const { entityCount, relCount } = await populateGraph(
        state.userId,
        extractedEntities as Parameters<typeof populateGraph>[1]
      );
      const newThings = entityCount + relCount;
      pipelineLog.push({
        stage: "graph",
        status: newThings > 0 ? "done" : "skip",
        detail: newThings > 0
          ? `${entityCount} new entit${entityCount !== 1 ? "ies" : "y"}, ${relCount} new relationship${relCount !== 1 ? "s" : ""}`
          : "No new entities to add",
      });
      console.log(`🕸️ Graph updated: ${entityCount} entities, ${relCount} relationships`);
    } catch (err) {
      console.warn("⚠️ Graph population failed:", err instanceof Error ? err.message : err);
      pipelineLog.push({ stage: "graph", status: "error", detail: "Graph update failed" });
    }
  }

  return { responseText, pipelineLog };
}
