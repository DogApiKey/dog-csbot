const API_BASE = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error (${response.status}): ${error}`);
  }

  return response.json();
}

// ─── Stats ──────────────────────────────────────────────────────────────────

export interface Stats {
  documents: {
    total: number;
    ready: number;
    processing: number;
    error: number;
  };
  conversations: {
    total: number;
  };
}

export async function getStats(): Promise<Stats> {
  return request("/admin/stats");
}

// ─── Documents ──────────────────────────────────────────────────────────────

export interface Document {
  id: string;
  title: string;
  source: string | null;
  content: string;
  metadata: Record<string, unknown>;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getDocuments(): Promise<{ documents: Document[] }> {
  return request("/admin/documents");
}

export async function createDocument(data: {
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string; status: string }> {
  return request("/admin/documents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteDocument(id: string): Promise<{ deleted: boolean }> {
  return request(`/admin/documents/${id}`, { method: "DELETE" });
}

export async function reindexDocument(id: string): Promise<{ status: string }> {
  return request(`/admin/documents/${id}/reindex`, { method: "POST" });
}

// ─── Conversations ──────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  channelId: string;
  userId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export async function getConversations(params?: {
  limit?: number;
  offset?: number;
  channelId?: string;
}): Promise<{ conversations: Conversation[] }> {
  const query = new URLSearchParams();
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.channelId) query.set("channelId", params.channelId);
  return request(`/admin/conversations?${query}`);
}

export async function getConversationMessages(
  conversationId: string,
): Promise<{ messages: Message[] }> {
  return request(`/admin/conversations/${conversationId}/messages`);
}
