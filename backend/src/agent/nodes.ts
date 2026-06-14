import { getRecentHistory, saveConversation, getEntityFacts } from "../db/memory";
import { generateEmbedding, findSimilarConversations, warmupEmbedder } from "../db/embeddings";
import { getIrisTools, callIrisTool } from "../services/irisClient";
import { GroqLLM } from "../llms/GroqLLM";
import { AgentState, Message } from "./state";

// Pre-load the embedding model so the first user message isn't slow
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
  return data.choices[0].message as Message;
}

export async function loadContext(state: AgentState): Promise<Partial<AgentState>> {
  console.log("🔍 [loadContext] Loading history, memory, and tools");

  const [history, entityFacts] = await Promise.all([
    getRecentHistory(state.userId, 5),
    getEntityFacts(state.userId),
  ]);

  // Semantic retrieval — fails gracefully if no embeddings exist yet
  let episodic: Array<{ message: string; response: string }> = [];
  try {
    const queryEmbedding = await generateEmbedding(state.userMessage);
    episodic = await findSimilarConversations(state.userId, queryEmbedding, 3);
  } catch (err) {
    console.warn("⚠️ [loadContext] Semantic retrieval skipped:", err instanceof Error ? err.message : err);
  }

  // Build memory context to inject into the system prompt
  const memoryParts: string[] = [];
  if (entityFacts) {
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

  let tools: Awaited<ReturnType<typeof getIrisTools>> = [];
  try {
    tools = await getIrisTools();
  } catch (error) {
    console.warn("⚠️ [loadContext] Could not fetch Iris tools:", error instanceof Error ? error.message : error);
    systemContent += "\n\nNOTE: Your communication tools (email, SMS) are currently unavailable. If the user asks you to send a message, tell them honestly that you're unable to right now.";
  }

  const messages: Message[] = [
    { role: "system", content: systemContent },
    ...historyToMessages(history),
    { role: "user", content: state.userMessage.trim() },
  ];

  return { messages, tools };
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

  const responseText = state.toolError
    ? "I'm sorry, dear. I wasn't able to send that for you — there seems to be a problem with my email connection right now. I won't try again on my own, but just let me know if you'd like me to try once more."
    : (state.messages[state.messages.length - 1].content ?? "I'm sorry, I couldn't process that.");

  await saveConversation(state.userId, state.userMessage, responseText, groqLlm);

  return { responseText };
}
