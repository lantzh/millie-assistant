import { db, conversations } from "./index";
import { desc, eq } from "drizzle-orm";

export const saveConversation = async (
  userId: string,
  message: string,
  response: string
) => {
  await db.insert(conversations).values({
    userId,
    message,
    response,
  });
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
