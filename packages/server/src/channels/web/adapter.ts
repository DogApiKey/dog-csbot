import type { ChannelAdapter, ChannelMessage, BotResponse } from "../types.ts";
import type { SSEManager } from "./sse-manager.ts";
import type { MessageBus } from "../bus.ts";

/**
 * Web channel adapter.
 * Handles HTTP-based chat via REST API + SSE streaming.
 */
export class WebAdapter implements ChannelAdapter {
  readonly name = "web";
  private messageHandler?: (msg: ChannelMessage) => Promise<void>;
  private sseManager: SSEManager;
  private messageBus: MessageBus;

  constructor(sseManager: SSEManager, messageBus: MessageBus) {
    this.sseManager = sseManager;
    this.messageBus = messageBus;
  }

  async init(): Promise<void> {
    // Web adapter doesn't need external initialization
  }

  onMessage(handler: (msg: ChannelMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  /**
   * Handle an incoming web chat message (called from HTTP route).
   */
  async handleMessage(conversationId: string, content: string, userId?: string): Promise<void> {
    if (!this.messageHandler) {
      throw new Error("No message handler registered");
    }

    const message: ChannelMessage = {
      channelId: "web",
      conversationId,
      userId,
      content,
      metadata: {},
      timestamp: Date.now(),
    };

    await this.messageHandler(message);
  }

  async reply(conversationId: string, response: BotResponse): Promise<void> {
    await this.messageBus.publish(conversationId, JSON.stringify({
      type: response.isFinal ? "text_done" : "text_delta",
      data: response.content,
    }));
  }

  async streamReply(conversationId: string, chunk: BotResponse): Promise<void> {
    await this.reply(conversationId, chunk);
  }

  /**
   * Get an SSE stream for a conversation.
   */
  getStream(conversationId: string): ReadableStream {
    return this.sseManager.createStream(conversationId);
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}
