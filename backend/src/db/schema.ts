import {
  pgTable,
  serial,
  text,
  timestamp,
  vector,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default_user"), // For now everyone is default_user
  message: text("message").notNull(),
  response: text("response").notNull(),
  messageEmbedding: vector("message_embedding", { dimensions: 384 }), // For semantic search later
  entities: jsonb("entities"), // Store extracted entities (names, medications, etc.)
  createdAt: timestamp("created_at").defaultNow(),
});

// Memory snapshots for conversation summaries
export const memorySnapshots = pgTable("memory_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default_user"),
  summary: text("summary").notNull(),
  conversationCount: serial("conversation_count"),
  createdAt: timestamp("created_at").defaultNow(),
});
