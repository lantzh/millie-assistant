import { db } from "./index";
import { sql } from "drizzle-orm";

type Pipeline = Awaited<ReturnType<typeof loadPipeline>>;
let _embedder: Pipeline | null = null;

async function loadPipeline() {
  const { pipeline } = await import("@huggingface/transformers");
  return pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", {
    dtype: "fp32",
  });
}

async function getEmbedder(): Promise<Pipeline> {
  if (!_embedder) {
    console.log("🔄 Loading embedding model (first run may take a moment)...");
    _embedder = await loadPipeline();
    console.log("✅ Embedding model ready");
  }
  return _embedder;
}

export async function warmupEmbedder(): Promise<void> {
  await getEmbedder();
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await (embedder as (text: string, options: Record<string, unknown>) => Promise<{ data: Float32Array }>)(
    text,
    { pooling: "mean", normalize: true }
  );
  return Array.from(output.data);
}

export async function storeEmbedding(conversationId: number, embedding: number[]): Promise<void> {
  const vectorLiteral = `[${embedding.join(",")}]`;
  await db.execute(
    sql`UPDATE conversations SET message_embedding = ${vectorLiteral}::vector WHERE id = ${conversationId}`
  );
}

export async function findSimilarConversations(
  userId: string,
  queryEmbedding: number[],
  limit = 3
): Promise<Array<{ message: string; response: string }>> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const results = await db.execute(
    sql`SELECT message, response
        FROM conversations
        WHERE user_id = ${userId}
          AND message_embedding IS NOT NULL
        ORDER BY message_embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}`
  );
  return results as unknown as Array<{ message: string; response: string }>;
}
