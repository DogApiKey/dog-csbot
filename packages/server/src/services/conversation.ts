import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Database } from "../db/index.ts";
import { conversations, messages } from "../db/schema.ts";

export class ConversationService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Create a new conversation.
   */
  async create(channelId: string, userId?: string, metadata?: Record<string, unknown>) {
    const [conv] = await this.db
      .insert(conversations)
      .values({
        channelId,
        userId: userId ?? null,
        metadata: metadata ?? {},
      })
      .returning();

    return conv;
  }

  /**
   * Get a conversation by ID.
   */
  async getById(id: string) {
    const [conv] = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return conv ?? null;
  }

  /**
   * Add a message to a conversation.
   */
  async addMessage(conversationId: string, role: "user" | "assistant" | "system", content: string, metadata?: Record<string, unknown>) {
    const [msg] = await this.db
      .insert(messages)
      .values({
        conversationId,
        role,
        content,
        metadata: metadata ?? {},
      })
      .returning();

    // Update conversation timestamp
    await this.db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    return msg;
  }

  /**
   * Get all messages for a conversation.
   */
  async getMessages(conversationId: string, limit: number = 50) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  /**
   * Get recent messages for context (chronological order).
   */
  async getRecentMessages(conversationId: string, limit: number = 20) {
    const recent = await this.getMessages(conversationId, limit);
    return recent.reverse(); // chronological order
  }

  /**
   * List conversations with pagination.
   */
  async list(options: { channelId?: string; limit?: number; offset?: number } = {}) {
    const { channelId, limit = 20, offset = 0 } = options;

    let query = this.db.select().from(conversations);

    if (channelId) {
      query = query.where(eq(conversations.channelId, channelId)) as typeof query;
    }

    return query.orderBy(desc(conversations.updatedAt)).limit(limit).offset(offset);
  }
}
