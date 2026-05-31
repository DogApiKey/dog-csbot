import type { Database } from "../db/index.ts";
import { documentChunks } from "../db/schema.ts";
import { sql } from "drizzle-orm";

export interface SearchChunk {
  content: string;
  score: number;
  documentId: string;
  chunkIndex: number;
}

export interface RetrievalResult {
  chunks: SearchChunk[];
  query: string;
  source: "vector" | "keyword";
}

/**
 * Client for calling the vector-proxy search API.
 * Sends text queries to the proxy which handles embedding + vector search.
 */
export class VectorSearchClient {
  private apiUrl: string;
  private headers: Record<string, string>;

  constructor(apiUrl: string, apiKey?: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      this.headers["Authorization"] = `Bearer ${apiKey}`;
    }
  }

  /**
   * Search the vector store by text. The proxy handles embedding the query.
   */
  async search(
    text: string,
    topK: number = 5,
    timeoutMs: number = 5000,
  ): Promise<SearchChunk[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.apiUrl}/search`, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ text, topK }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Vector search failed (${response.status}): ${error}`);
      }

      const data = (await response.json()) as {
        matches: Array<{
          id: string;
          score: number;
          metadata?: Record<string, unknown>;
        }>;
      };

      return (data.matches || []).map((m) => ({
        content: (m.metadata?.content as string) || "",
        score: m.score,
        documentId: (m.metadata?.documentId as string) || "",
        chunkIndex: (m.metadata?.chunkIndex as number) || 0,
      }));
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface RetrieverOptions {
  topK?: number;
  vectorClient?: VectorSearchClient;
  vectorTimeoutMs?: number;
}

/**
 * RAG retriever with vector search (primary) and PostgreSQL keyword fallback.
 */
export class Retriever {
  private db: Database;
  private topK: number;
  private vectorClient?: VectorSearchClient;
  private vectorTimeoutMs: number;

  constructor(db: Database, options: RetrieverOptions = {}) {
    this.db = db;
    this.topK = options.topK ?? 5;
    this.vectorClient = options.vectorClient;
    this.vectorTimeoutMs = options.vectorTimeoutMs ?? 5000;
  }

  /**
   * Retrieve relevant chunks.
   * Tries vector search first; falls back to PostgreSQL keyword search on failure.
   */
  async retrieve(query: string): Promise<RetrievalResult> {
    // Try vector search first if client is available
    if (this.vectorClient) {
      try {
        const chunks = await this.vectorClient.search(query, this.topK, this.vectorTimeoutMs);
        if (chunks.length > 0) {
          console.log(`[retriever] Vector search returned ${chunks.length} chunks`);
          return { chunks, query, source: "vector" };
        }
        console.log("[retriever] Vector search returned 0 results, falling back to keyword search");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[retriever] Vector search failed (${msg}), falling back to keyword search`);
      }
    }

    // Fallback: PostgreSQL keyword search
    const chunks = await this.keywordSearch(query);
    console.log(`[retriever] Keyword search returned ${chunks.length} chunks`);
    return { chunks, query, source: "keyword" };
  }

  /**
   * PostgreSQL full-text keyword search (fallback).
   */
  private async keywordSearch(query: string): Promise<SearchChunk[]> {
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      return [];
    }

    // Build OR conditions for each keyword
    const conditions = keywords.map(
      (keyword) => sql`LOWER(${documentChunks.content}) LIKE ${`%${keyword}%`}`,
    );

    const results = await this.db
      .select({
        content: documentChunks.content,
        documentId: documentChunks.documentId,
        chunkIndex: documentChunks.chunkIndex,
      })
      .from(documentChunks)
      .where(sql.join(conditions, sql` OR `))
      .limit(this.topK);

    // Simple relevance scoring based on keyword match count
    const scored = results.map((r) => {
      const contentLower = r.content.toLowerCase();
      const matchCount = keywords.filter((kw) => contentLower.includes(kw)).length;
      return {
        content: r.content,
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        score: matchCount / keywords.length,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return scored;
  }

  /**
   * Extract keywords from query text (supports Chinese and English).
   */
  private extractKeywords(query: string): string[] {
    const lower = query.toLowerCase();

    // Split by whitespace and punctuation
    const tokens = lower.split(/[\s，。！？、；：""''（）【】\[\]\.,!?;:'"()\s]+/).filter((t) => t.length > 0);

    // For Chinese, also extract 2-4 character substrings
    const keywords: string[] = [];
    for (const token of tokens) {
      if (token.length <= 4) {
        keywords.push(token);
      } else {
        // Extract meaningful substrings
        for (let len = 2; len <= Math.min(4, token.length); len++) {
          for (let i = 0; i <= token.length - len; i++) {
            keywords.push(token.slice(i, i + len));
          }
        }
      }
    }

    // Remove duplicates and very short tokens
    return [...new Set(keywords)].filter((k) => k.length >= 2);
  }

  /**
   * Format retrieved chunks as context for the LLM.
   */
  formatContext(result: RetrievalResult): string {
    if (result.chunks.length === 0) {
      return "No relevant information found in the knowledge base.";
    }

    const formatted = result.chunks
      .map((chunk, i) => `[${i + 1}] (relevance: ${(chunk.score * 100).toFixed(0)}%)\n${chunk.content}`)
      .join("\n\n---\n\n");

    return `Relevant knowledge base entries:\n\n${formatted}`;
  }
}
