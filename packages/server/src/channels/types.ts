/**
 * Unified message format across all channels.
 * Every channel adapter normalizes incoming messages to this format.
 */
export interface ChannelMessage {
  /** Channel identifier: 'web' | 'telegram' | 'discord' | etc. */
  channelId: string;
  /** Conversation ID (unique per user session) */
  conversationId: string;
  /** User identifier within the channel */
  userId?: string;
  /** Text content of the message */
  content: string;
  /** Channel-specific metadata */
  metadata: Record<string, unknown>;
  /** Unix timestamp in milliseconds */
  timestamp: number;
}

/**
 * Response from the bot to be delivered back through a channel.
 */
export interface BotResponse {
  /** Text content */
  content: string;
  /** Whether this is a partial (streaming) response */
  isPartial: boolean;
  /** Whether this is the final chunk */
  isFinal: boolean;
  /** Optional metadata (tokens used, model, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Channel adapter interface.
 * Each platform (web, telegram, discord) implements this.
 */
export interface ChannelAdapter {
  /** Unique channel name */
  readonly name: string;

  /** Initialize the adapter (register webhooks, connect to platform, etc.) */
  init(): Promise<void>;

  /** Register a handler for incoming messages */
  onMessage(handler: (msg: ChannelMessage) => Promise<void>): void;

  /** Send a response back to a conversation */
  reply(conversationId: string, response: BotResponse): Promise<void>;

  /** Stream a response chunk to a conversation */
  streamReply(conversationId: string, chunk: BotResponse): Promise<void>;

  /** Cleanup on shutdown */
  shutdown(): Promise<void>;
}
