import { useEffect, useState, useCallback } from "react";
import {
  getConversations,
  getConversationMessages,
  type Conversation,
  type Message,
} from "../api/client.ts";

export default function Conversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations({ limit: 50 });
      setConversations(data.conversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const loadMessages = async (conv: Conversation) => {
    setSelected(conv);
    setLoadingMessages(true);
    try {
      const data = await getConversationMessages(conv.id);
      setMessages(data.messages);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const roleBadge = (role: string) => {
    const classes: Record<string, string> = {
      user: "bg-blue-100 text-blue-800",
      assistant: "bg-green-100 text-green-800",
      system: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${classes[role] ?? classes.system}`}
      >
        {role}
      </span>
    );
  };

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h2>

      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Conversation List */}
        <div className="w-80 flex-shrink-0">
          {loading ? (
            <div className="animate-pulse text-gray-400">Loading...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No conversations yet.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full overflow-y-auto">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadMessages(conv)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selected?.id === conv.id ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {conv.channelId}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {conv.userId ?? "Anonymous"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message View */}
        <div className="flex-1">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a conversation to view messages
            </div>
          ) : loadingMessages ? (
            <div className="animate-pulse text-gray-400">Loading messages...</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">
                  Conversation {selected.id.slice(0, 8)}...
                </h3>
                <div className="text-xs text-gray-500 mt-1">
                  Channel: {selected.channelId} | User:{" "}
                  {selected.userId ?? "Anonymous"} | Created:{" "}
                  {new Date(selected.createdAt).toLocaleString()}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400">
                    No messages in this conversation
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-xl px-4 py-2 ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : msg.role === "assistant"
                              ? "bg-gray-100 text-gray-900"
                              : "bg-yellow-50 text-yellow-800 text-sm"
                        }`}
                      >
                        <div className="mb-1">{roleBadge(msg.role)}</div>
                        <div className="whitespace-pre-wrap text-sm">
                          {msg.content}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            msg.role === "user"
                              ? "text-indigo-200"
                              : "text-gray-400"
                          }`}
                        >
                          {new Date(msg.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
