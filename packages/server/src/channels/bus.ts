import Redis from "ioredis";

/**
 * Redis Pub/Sub message bus for cross-instance communication.
 * Used to broadcast SSE messages to the correct server node.
 */
export class MessageBus {
  private publisher: Redis;
  private subscriber: Redis;
  private handlers = new Map<string, Set<(data: string) => void>>();

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);

    this.subscriber.on("message", (channel, message) => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        for (const handler of handlers) {
          handler(message);
        }
      }
    });
  }

  /**
   * Publish a message to a conversation channel.
   */
  async publish(conversationId: string, data: string): Promise<void> {
    await this.publisher.publish(`conv:${conversationId}`, data);
  }

  /**
   * Subscribe to messages for a conversation.
   * Returns an unsubscribe function.
   */
  subscribe(conversationId: string, handler: (data: string) => void): () => void {
    const channel = `conv:${conversationId}`;

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      this.subscriber.subscribe(channel);
    }

    this.handlers.get(channel)!.add(handler);

    return () => {
      const handlers = this.handlers.get(channel);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(channel);
          this.subscriber.unsubscribe(channel);
        }
      }
    };
  }

  async shutdown(): Promise<void> {
    await this.publisher.quit();
    await this.subscriber.quit();
  }
}
