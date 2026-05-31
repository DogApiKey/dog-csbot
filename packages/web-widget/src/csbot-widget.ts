import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { StreamClient, type StreamCallbacks } from "./stream-client.ts";
import { widgetStyles } from "./styles.ts";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

/**
 * <csbot-widget> - Embeddable customer service chat widget.
 *
 * Usage:
 * ```html
 * <script src="https://your-domain/csbot-widget.js"></script>
 * <csbot-widget api-url="https://your-domain/api"></csbot-widget>
 * ```
 */
@customElement("csbot-widget")
export class CsbotWidget extends LitElement {
  @property({ type: String, attribute: "api-url" })
  apiUrl = "http://localhost:3000";

  @property({ type: String, attribute: "greeting" })
  greeting = "Hello! How can I help you today?";

  @property({ type: String, attribute: "title" })
  title = "Customer Service";

  @state()
  private isOpen = false;

  @state()
  private messages: Message[] = [];

  @state()
  private inputValue = "";

  @state()
  private isStreaming = false;

  private streamClient: StreamClient | null = null;
  private conversationId: string | null = null;

  static styles = unsafeCSS(widgetStyles);

  connectedCallback() {
    super.connectedCallback();
    this.streamClient = new StreamClient(this.apiUrl);

    // Restore conversation from localStorage
    const saved = localStorage.getItem("csbot_conversation_id");
    if (saved) {
      this.conversationId = saved;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.streamClient?.close();
  }

  private toggleChat() {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.messages.length === 0) {
      this.messages = [
        {
          role: "system",
          content: this.greeting,
          timestamp: Date.now(),
        },
      ];
    }
  }

  private async sendMessage() {
    const content = this.inputValue.trim();
    if (!content || this.isStreaming || !this.streamClient) return;

    // Add user message
    this.messages = [
      ...this.messages,
      { role: "user", content, timestamp: Date.now() },
    ];
    this.inputValue = "";
    this.isStreaming = true;

    // Add placeholder for assistant response
    const assistantIndex = this.messages.length;
    this.messages = [
      ...this.messages,
      { role: "assistant", content: "", timestamp: Date.now() },
    ];

    const callbacks: StreamCallbacks = {
      onTextDelta: (delta) => {
        this.messages = this.messages.map((m, i) =>
          i === assistantIndex ? { ...m, content: m.content + delta } : m,
        );
      },
      onTextDone: () => {
        this.isStreaming = false;
        // Save conversation ID
        if (this.conversationId) {
          localStorage.setItem("csbot_conversation_id", this.conversationId);
        }
      },
      onError: (error) => {
        this.isStreaming = false;
        this.messages = this.messages.map((m, i) =>
          i === assistantIndex
            ? { ...m, content: `Sorry, an error occurred: ${error}` }
            : m,
        );
      },
    };

    try {
      // Send message and get conversation ID
      const convId = await this.streamClient.sendMessage(
        this.conversationId ?? "",
        content,
        callbacks,
      );
      this.conversationId = convId;
    } catch (error) {
      callbacks.onError?.(String(error));
    }
  }

  private handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private renderMessages() {
    return this.messages.map((msg) => {
      if (msg.role === "system") {
        return html`<div class="message system">${msg.content}</div>`;
      }
      return html`<div class="message ${msg.role}">${msg.content}</div>`;
    });
  }

  render() {
    return html`
      ${this.isOpen
        ? html`
            <div class="chat-panel">
              <div class="header">
                <h3>${this.title}</h3>
                <button class="close-btn" @click=${this.toggleChat}>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div class="messages" id="messages">
                ${this.renderMessages()}
                ${this.isStreaming
                  ? html`
                      <div class="typing-indicator">
                        <span></span><span></span><span></span>
                      </div>
                    `
                  : ""}
              </div>

              <div class="input-area">
                <input
                  type="text"
                  placeholder="Type a message..."
                  .value=${this.inputValue}
                  @input=${(e: Event) => {
                    this.inputValue = (e.target as HTMLInputElement).value;
                  }}
                  @keydown=${this.handleKeydown}
                  ?disabled=${this.isStreaming}
                />
                <button @click=${this.sendMessage} ?disabled=${this.isStreaming || !this.inputValue.trim()}>
                  Send
                </button>
              </div>
            </div>
          `
        : ""}

      <button class="toggle-btn" @click=${this.toggleChat}>
        ${this.isOpen
          ? html`
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            `
          : html`
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            `}
      </button>
    `;
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    // Auto-scroll to bottom on new messages
    if (changedProperties.has("messages")) {
      const container = this.shadowRoot?.getElementById("messages");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "csbot-widget": CsbotWidget;
  }
}
