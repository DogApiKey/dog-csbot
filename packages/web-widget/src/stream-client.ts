export interface StreamCallbacks {
  onTextDelta?: (delta: string) => void;
  onTextDone?: (fullText: string) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
}

/**
 * Client for consuming SSE streams from the CSBot chat API.
 */
export class StreamClient {
  private apiUrl: string;
  private eventSource: EventSource | null = null;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
  }

  /**
   * Send a message and connect to the SSE stream for the response.
   */
  async sendMessage(
    conversationId: string,
    message: string,
    callbacks: StreamCallbacks,
  ): Promise<string> {
    try {
      // First, send the message via POST
      const response = await fetch(`${this.apiUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });

      if (!response.ok) {
        const error = await response.text();
        callbacks.onError?.(`Failed to send message: ${error}`);
        return conversationId;
      }

      const data = await response.json();
      const streamConversationId = data.conversationId;

      // Then connect to the SSE stream
      this.connectStream(streamConversationId, callbacks);

      return streamConversationId;
    } catch (error) {
      callbacks.onError?.(`Network error: ${error instanceof Error ? error.message : String(error)}`);
      return conversationId;
    }
  }

  /**
   * Connect to an existing conversation's SSE stream.
   */
  connectStream(conversationId: string, callbacks: StreamCallbacks): void {
    this.close();

    this.eventSource = new EventSource(`${this.apiUrl}/api/chat/${conversationId}/stream`);

    this.eventSource.addEventListener("connected", () => {
      callbacks.onConnected?.();
    });

    this.eventSource.addEventListener("text_delta", (event) => {
      callbacks.onTextDelta?.(event.data);
    });

    this.eventSource.addEventListener("text_done", (event) => {
      callbacks.onTextDone?.(event.data);
      this.close();
    });

    this.eventSource.addEventListener("error", (event) => {
      if (event instanceof MessageEvent) {
        callbacks.onError?.(event.data);
      } else {
        callbacks.onError?.("Connection lost");
      }
      this.close();
    });

    this.eventSource.onerror = () => {
      // Reconnect will happen automatically by EventSource
      // But if the connection is truly lost, we close
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        callbacks.onError?.("Connection closed");
        this.close();
      }
    };
  }

  /**
   * Create a new conversation.
   */
  async createConversation(userId?: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}/api/chat/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      throw new Error("Failed to create conversation");
    }

    const data = await response.json();
    return data.conversationId;
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
