import type { MessageBus } from "../bus.ts";

export interface SSEConnection {
  conversationId: string;
  controller: ReadableStreamDefaultController;
  unsubscribe: () => void;
}

/**
 * Manages SSE (Server-Sent Events) connections for web chat.
 * Uses Redis Pub/Sub for cross-instance message broadcast.
 */
export class SSEManager {
  private connections = new Map<string, Set<SSEConnection>>();
  private messageBus: MessageBus;

  constructor(messageBus: MessageBus) {
    this.messageBus = messageBus;
  }

  /**
   * Create an SSE stream for a conversation.
   * Returns a ReadableStream that the client can consume.
   */
  createStream(conversationId: string): ReadableStream {
    let connection: SSEConnection;

    const stream = new ReadableStream({
      start: (controller) => {
        const encoder = new TextEncoder();

        // Send initial connection event
        controller.enqueue(encoder.encode("event: connected\ndata: {}\n\n"));

        // Subscribe to Redis messages for this conversation
        const unsubscribe = this.messageBus.subscribe(conversationId, (data) => {
          try {
            const parsed = JSON.parse(data);
            const eventType = parsed.type || "message";
            const eventData = parsed.data;
            // Send SSE event - data should be a plain string, not JSON-encoded
            const sseData = typeof eventData === "string" ? eventData : JSON.stringify(eventData);
            controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${sseData}\n\n`));
          } catch {
            controller.enqueue(encoder.encode(`event: message\ndata: ${data}\n\n`));
          }
        });

        connection = { conversationId, controller, unsubscribe };

        // Track the connection
        if (!this.connections.has(conversationId)) {
          this.connections.set(conversationId, new Set());
        }
        this.connections.get(conversationId)!.add(connection);
      },
      cancel: () => {
        if (connection) {
          connection.unsubscribe();
          const convConnections = this.connections.get(conversationId);
          if (convConnections) {
            convConnections.delete(connection);
            if (convConnections.size === 0) {
              this.connections.delete(conversationId);
            }
          }
        }
      },
    });

    return stream;
  }

  /**
   * Get the number of active connections for a conversation.
   */
  getConnectionCount(conversationId: string): number {
    return this.connections.get(conversationId)?.size ?? 0;
  }

  /**
   * Get total active connections across all conversations.
   */
  getTotalConnections(): number {
    let total = 0;
    for (const conns of this.connections.values()) {
      total += conns.size;
    }
    return total;
  }

  async shutdown(): Promise<void> {
    for (const conns of this.connections.values()) {
      for (const conn of conns) {
        conn.unsubscribe();
        try {
          conn.controller.close();
        } catch {
          // Already closed
        }
      }
    }
    this.connections.clear();
  }
}
