import { db, conversations } from "./index";
import { desc, eq, isNotNull, and } from "drizzle-orm";
import { LLM } from "@langchain/core/language_models/llms";
import { extractEntities } from "../services/entityExtractor";
import { generateEmbedding, storeEmbedding } from "./embeddings";

type EntityData = {
  medications?: Array<{ name: string; dosage?: string; frequency?: string }>;
  family_members?: Array<{ name: string; relationship?: string }>;
  health_conditions?: Array<{ condition: string }>;
  activities?: Array<{ type: string }>;
  future_tasks?: Array<{ task: string }>;
  reminders?: Array<{ reminder: string }>;
  goals?: Array<{ goal: string }>;
};

export const saveConversation = async (
  userId: string,
  message: string,
  response: string,
  llm?: LLM
) => {
  let entities = null;

  if (llm) {
    console.log("🔍 Extracting entities from conversation...");
    const conversationText = `Human: ${message}\nAssistant: ${response}`;
    entities = await extractEntities(conversationText, llm);
  }

  const [inserted] = await db
    .insert(conversations)
    .values({ userId, message, response, entities })
    .returning({ id: conversations.id });

  // Generate and store embedding in the background — doesn't block the response
  generateEmbedding(message)
    .then((embedding) => storeEmbedding(inserted.id, embedding))
    .then(() => console.log(`🔍 Embedding stored for conversation ${inserted.id}`))
    .catch((err) =>
      console.warn("⚠️ Embedding failed:", err instanceof Error ? err.message : err)
    );

  if (entities) {
    console.log("✅ Conversation saved with extracted entities");
  }
};

export const getRecentHistory = async (
  userId: string,
  limit: number = 5
): Promise<string> => {
  const recent = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt))
    .limit(limit);

  return recent
    .reverse()
    .map((conv) => `Human: ${conv.message}\nAssistant: ${conv.response}`)
    .join("\n");
};

export const getEntityFacts = async (userId: string): Promise<string> => {
  const recent = await db
    .select({ entities: conversations.entities })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNotNull(conversations.entities)))
    .orderBy(desc(conversations.createdAt))
    .limit(20);

  if (recent.length === 0) return "";

  const meds    = new Set<string>();
  const family  = new Set<string>();
  const health  = new Set<string>();
  const acts    = new Set<string>();
  const tasks   = new Set<string>();
  const remind  = new Set<string>();
  const goals   = new Set<string>();

  for (const row of recent) {
    const e = row.entities as EntityData | null;
    if (!e) continue;
    e.medications?.forEach((m) => m.name && meds.add(
      [m.name, m.dosage, m.frequency].filter(Boolean).join(" ")
    ));
    e.family_members?.forEach((f) => f.name && family.add(
      [f.relationship, f.name].filter(Boolean).join(" ")
    ));
    e.health_conditions?.forEach((c) => c.condition && health.add(c.condition));
    e.activities?.forEach((a) => a.type && acts.add(a.type));
    e.future_tasks?.forEach((t) => t.task && tasks.add(t.task));
    e.reminders?.forEach((r) => r.reminder && remind.add(r.reminder));
    e.goals?.forEach((g) => g.goal && goals.add(g.goal));
  }

  const lines: string[] = [];
  if (meds.size)   lines.push(`- Medications: ${[...meds].join("; ")}`);
  if (family.size) lines.push(`- Family: ${[...family].join(", ")}`);
  if (health.size) lines.push(`- Health conditions: ${[...health].join(", ")}`);
  if (acts.size)   lines.push(`- Activities: ${[...acts].join(", ")}`);
  if (tasks.size)  lines.push(`- Pending tasks: ${[...tasks].join("; ")}`);
  if (remind.size) lines.push(`- Reminders: ${[...remind].join("; ")}`);
  if (goals.size)  lines.push(`- Goals: ${[...goals].join("; ")}`);

  return lines.join("\n");
};
