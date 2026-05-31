import { pgTable, text, timestamp, uuid, integer, jsonb, index } from "drizzle-orm/pg-core";

// ─── Conversations ────────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: text("channel_id").notNull().default("web"),
    userId: text("user_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("conversations_channel_id_idx").on(table.channelId), index("conversations_user_id_idx").on(table.userId)],
);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'assistant' | 'system'
    content: text("content").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("messages_conversation_id_idx").on(table.conversationId)],
);

// ─── Documents (RAG source) ───────────────────────────────────────────────────

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  source: text("source"), // file path or URL
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'ready' | 'error'
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Document Chunks (tracks vector IDs for re-indexing) ──────────────────────

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    vectorId: text("vector_id").notNull(), // Qdrant point ID
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_chunks_document_id_idx").on(table.documentId)],
);
