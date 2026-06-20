import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  vector,
  jsonb,
  uniqueIndex,
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

export const entities = pgTable(
  "entities",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull(),
    properties: jsonb("properties"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("entity_user_name_type_idx").on(t.userId, t.name, t.type)]
);

export const entityRelationships = pgTable(
  "entity_relationships",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => entities.id),
    targetId: integer("target_id")
      .notNull()
      .references(() => entities.id),
    relationshipType: text("relationship_type").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [uniqueIndex("rel_source_target_type_idx").on(t.sourceId, t.targetId, t.relationshipType)]
);

// Memory snapshots for conversation summaries
export const memorySnapshots = pgTable("memory_snapshots", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().default("default_user"),
  summary: text("summary").notNull(),
  conversationCount: serial("conversation_count"),
  createdAt: timestamp("created_at").defaultNow(),
});
