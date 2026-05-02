import { db, conversations } from "./index";
import { desc, eq } from "drizzle-orm";
import { LLM } from "@langchain/core/language_models/llms";
import { extractEntities } from "../services/entityExtractor";

export const saveConversation = async (
  userId: string,
  message: string,
  response: string,
  llm?: LLM
) => {
  let entities = null;
  
  // Extract entities if LLM is provided
  if (llm) {
    console.log("🔍 Extracting entities from conversation...");
    const conversationText = `Human: ${message}\nAssistant: ${response}`;
    entities = await extractEntities(conversationText, llm);
  }
  
  await db.insert(conversations).values({
    userId,
    message,
    response,
    entities: entities,
  });
  
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
