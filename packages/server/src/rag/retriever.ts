import type { Database } from "../db/index.ts";
import { documentChunks } from "../db/schema.ts";
import { sql } from "drizzle-orm";

export interface RetrievalResult {
  chunks: Array<{ content: string; score: number; documentId: string; chunkIndex: number }>;
  query: string;
}

/**
 * RAG retriever using PostgreSQL full-text search.
 * Falls back to keyword matching when no embedding API is available.
 */
export class Retriever {
  private db: Database;
  private topK: number;

  constructor(db: Database, topK: number = 5) {
    this.db = db;
    this.topK = topK;
  }

  /**
   * Retrieve relevant chunks using PostgreSQL full-text search.
   */
  async retrieve(query: string): Promise<RetrievalResult> {
    // Extract keywords from query (supports Chinese and English)
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      return { chunks: [], query };
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

    return { chunks: scored, query };
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
