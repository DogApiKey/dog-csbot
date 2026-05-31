export const widgetStyles = `
  :host {
    --csbot-primary: #4f46e5;
    --csbot-primary-hover: #4338ca;
    --csbot-bg: #ffffff;
    --csbot-bg-secondary: #f9fafb;
    --csbot-text: #111827;
    --csbot-text-secondary: #6b7280;
    --csbot-border: #e5e7eb;
    --csbot-user-bubble: #4f46e5;
    --csbot-user-text: #ffffff;
    --csbot-bot-bubble: #f3f4f6;
    --csbot-bot-text: #111827;
    --csbot-radius: 12px;
    --csbot-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);

    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: var(--csbot-text);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Toggle Button */
  .toggle-btn {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--csbot-primary);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--csbot-shadow);
    transition: transform 0.2s, background 0.2s;
  }

  .toggle-btn:hover {
    background: var(--csbot-primary-hover);
    transform: scale(1.05);
  }

  .toggle-btn svg {
    width: 24px;
    height: 24px;
  }

  /* Chat Panel */
  .chat-panel {
    position: absolute;
    bottom: 70px;
    right: 0;
    width: 380px;
    height: 520px;
    background: var(--csbot-bg);
    border-radius: var(--csbot-radius);
    box-shadow: var(--csbot-shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--csbot-border);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Header */
  .header {
    padding: 16px;
    background: var(--csbot-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .header .close-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .header .close-btn:hover {
    background: rgba(255,255,255,0.2);
  }

  /* Messages */
  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message {
    max-width: 85%;
    padding: 10px 14px;
    border-radius: var(--csbot-radius);
    word-wrap: break-word;
    white-space: pre-wrap;
  }

  .message.user {
    align-self: flex-end;
    background: var(--csbot-user-bubble);
    color: var(--csbot-user-text);
    border-bottom-right-radius: 4px;
  }

  .message.assistant {
    align-self: flex-start;
    background: var(--csbot-bot-bubble);
    color: var(--csbot-bot-text);
    border-bottom-left-radius: 4px;
  }

  .message.system {
    align-self: center;
    background: transparent;
    color: var(--csbot-text-secondary);
    font-size: 12px;
    padding: 4px 0;
  }

  /* Typing indicator */
  .typing-indicator {
    display: flex;
    gap: 4px;
    padding: 10px 14px;
    align-self: flex-start;
    background: var(--csbot-bot-bubble);
    border-radius: var(--csbot-radius);
    border-bottom-left-radius: 4px;
  }

  .typing-indicator span {
    width: 8px;
    height: 8px;
    background: var(--csbot-text-secondary);
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out;
  }

  .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
  .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
  }

  /* Input Area */
  .input-area {
    padding: 12px 16px;
    border-top: 1px solid var(--csbot-border);
    display: flex;
    gap: 8px;
    background: var(--csbot-bg);
  }

  .input-area input {
    flex: 1;
    padding: 10px 14px;
    border: 1px solid var(--csbot-border);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
  }

  .input-area input:focus {
    border-color: var(--csbot-primary);
  }

  .input-area button {
    padding: 10px 16px;
    background: var(--csbot-primary);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .input-area button:hover {
    background: var(--csbot-primary-hover);
  }

  .input-area button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Greeting */
  .greeting {
    text-align: center;
    color: var(--csbot-text-secondary);
    padding: 20px;
    font-size: 13px;
  }

  /* Hidden state */
  .hidden {
    display: none !important;
  }

  /* Markdown styles */
  .message.assistant p {
    margin: 0 0 8px 0;
  }
  .message.assistant p:last-child {
    margin-bottom: 0;
  }
  .message.assistant strong {
    font-weight: 600;
  }
  .message.assistant em {
    font-style: italic;
  }
  .message.assistant code {
    background: rgba(0,0,0,0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
  }
  .message.assistant pre {
    background: rgba(0,0,0,0.06);
    padding: 8px 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 8px 0;
  }
  .message.assistant pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
  }
  .message.assistant ul, .message.assistant ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  .message.assistant li {
    margin: 2px 0;
  }
  .message.assistant a {
    color: var(--csbot-primary);
    text-decoration: underline;
  }
  .message.assistant a:hover {
    opacity: 0.8;
  }
  .message.assistant h2, .message.assistant h3, .message.assistant h4 {
    margin: 12px 0 4px 0;
    font-weight: 600;
  }
  .message.assistant h2 { font-size: 1.1em; }
  .message.assistant h3 { font-size: 1em; }
  .message.assistant h4 { font-size: 0.95em; }
  .message.assistant hr {
    border: none;
    border-top: 1px solid var(--csbot-border);
    margin: 8px 0;
  }
  .message.assistant del {
    opacity: 0.6;
  }
`;
