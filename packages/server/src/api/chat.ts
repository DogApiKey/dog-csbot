import { Hono } from "hono";
import type { WebAdapter } from "../channels/web/adapter.ts";
import type { Orchestrator } from "../agent/orchestrator.ts";
import type { ConversationService } from "../services/conversation.ts";

export interface ChatRoutesOptions {
  webAdapter: WebAdapter;
  orchestrator: Orchestrator;
  conversationService: ConversationService;
}

export function createChatRoutes(options: ChatRoutesOptions): Hono {
  const app = new Hono();
  const { webAdapter, orchestrator, conversationService } = options;

  /**
   * POST /api/chat
   * Send a message. Creates a new conversation if conversationId is not provided.
   */
  app.post("/api/chat", async (c) => {
    const body = await c.req.json<{ conversationId?: string; message: string; userId?: string }>();

    if (!body.message?.trim()) {
      return c.json({ error: "Message is required" }, 400);
    }

    // Get or create conversation
    let conversationId = body.conversationId;
    if (!conversationId) {
      const conv = await conversationService.create("web", body.userId);
      conversationId = conv.id;
    }

    // Process message asynchronously (fire and forget for streaming)
    orchestrator.processMessage(conversationId, body.message).catch((err) => {
      console.error("Error processing message:", err);
    });

    return c.json({
      conversationId,
      message: "Message received",
    });
  });

  /**
   * GET /api/chat/:conversationId/stream
   * SSE stream for real-time response delivery.
   */
  app.get("/api/chat/:conversationId/stream", (c) => {
    const conversationId = c.req.param("conversationId");
    const stream = webAdapter.getStream(conversationId);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
      },
    });
  });

  /**
   * GET /api/chat/:conversationId/messages
   * Get message history for a conversation.
   */
  app.get("/api/chat/:conversationId/messages", async (c) => {
    const conversationId = c.req.param("conversationId");
    const limit = parseInt(c.req.query("limit") ?? "50", 10);

    const msgs = await conversationService.getMessages(conversationId, limit);

    return c.json({
      conversationId,
      messages: msgs.reverse(), // chronological order
    });
  });

  /**
   * POST /api/chat/conversations
   * Create a new conversation without sending a message.
   */
  app.post("/api/chat/conversations", async (c) => {
    const body = await c.req.json<{ userId?: string; metadata?: Record<string, unknown> }>();
    const conv = await conversationService.create("web", body.userId, body.metadata);

    return c.json({ conversationId: conv.id });
  });

  return app;
}
