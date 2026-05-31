/**
 * Cloudflare Vectorize adapter for CSBot.
 *
 * Communicates with a Cloudflare Worker proxy that wraps the Vectorize API.
 * The Worker is deployed at a custom domain (e.g., vector.orcax.net).
 */

export interface CFVectorizeStoreOptions {
  /** Worker API base URL (e.g., https://vector.orcax.net) */
  apiUrl: string;
  /** API key for authentication */
  apiKey?: string;
}

export interface VectorPoint {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  documentId: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

/**
 * Cloudflare Vectorize 向量存储适配器
 */
export class CFVectorizeStore {
  private apiUrl: string;
  private headers: Record<string, string>;

  constructor(options: CFVectorizeStoreOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
    };
    if (options.apiKey) {
      this.headers["Authorization"] = `Bearer ${options.apiKey}`;
    }
  }

  /**
   * 健康检查
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 获取索引信息
   */
  async describe(): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.apiUrl}/describe`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Describe failed: ${response.status}`);
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /**
   * 插入/更新向量
   */
  async upsert(points: VectorPoint[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/upsert`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ vectors: points }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Upsert failed (${response.status}): ${error}`);
    }
  }

  /**
   * 向量搜索
   */
  async search(
    vector: number[],
    limit: number = 10,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const response = await fetch(`${this.apiUrl}/search`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        vector,
        topK: limit,
        returnMetadata: true,
        filter,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      matches: Array<{
        id: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
    };

    return (data.matches || []).map((m) => ({
      id: m.id,
      score: m.score,
      content: (m.metadata?.content as string) || "",
      documentId: (m.metadata?.documentId as string) || "",
      chunkIndex: (m.metadata?.chunkIndex as number) || 0,
      metadata: m.metadata,
    }));
  }

  /**
   * 混合搜索（向量 + 关键词重排序）
   */
  async hybridSearch(
    vector: number[],
    query: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    // Vector search
    const vectorResults = await this.search(vector, limit * 2);

    // Keyword boosting
    const queryLower = query.toLowerCase();
    const reranked = vectorResults
      .map((r) => {
        const contentLower = r.content.toLowerCase();
        const hasMatch = queryLower
          .split(/\s+/)
          .some((word) => word.length > 1 && contentLower.includes(word));
        return {
          ...r,
          adjustedScore: hasMatch ? r.score * 1.2 : r.score,
        };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, limit);

    return reranked;
  }

  /**
   * 删除指定文档的所有向量
   */
  async deleteByDocument(documentId: string): Promise<void> {
    // First, search for all vectors with this documentId
    const results = await this.search([], 1000, { documentId });

    if (results.length === 0) return;

    // Delete by IDs
    const ids = results.map((r) => r.id);
    await this.deleteByIds(ids);
  }

  /**
   * 按 ID 删除向量
   */
  async deleteByIds(ids: string[]): Promise<void> {
    const response = await fetch(`${this.apiUrl}/delete`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Delete failed (${response.status}): ${error}`);
    }
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}
