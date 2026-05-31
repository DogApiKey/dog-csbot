import { QdrantClient } from "@qdrant/js-client-rest";

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    documentId: string;
    chunkIndex: number;
    content: string;
    metadata?: Record<string, unknown>;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  documentId: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export class VectorStore {
  private client: QdrantClient;
  private collectionName: string;
  private vectorSize: number;

  constructor(qdrantUrl: string, collectionName: string, vectorSize: number) {
    this.client = new QdrantClient({ url: qdrantUrl });
    this.collectionName = collectionName;
    this.vectorSize = vectorSize;
  }

  /**
   * Ensure the collection exists. Create if not.
   */
  async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === this.collectionName);

    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: this.vectorSize,
          distance: "Cosine",
        },
      });
      // Create payload index for full-text search on content
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "content",
        field_schema: "text",
      });
      // Create payload index for documentId filtering
      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "documentId",
        field_schema: "keyword",
      });
    }
  }

  /**
   * Upsert vector points.
   */
  async upsert(points: VectorPoint[]): Promise<void> {
    await this.client.upsert(this.collectionName, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  /**
   * Search for similar vectors.
   */
  async search(vector: number[], limit: number = 10, documentId?: string): Promise<SearchResult[]> {
    const filter = documentId
      ? {
          must: [
            {
              key: "documentId",
              match: { value: documentId },
            },
          ],
        }
      : undefined;

    const results = await this.client.search(this.collectionName, {
      vector,
      limit,
      with_payload: true,
      filter,
    });

    return results.map((r) => ({
      id: r.id as string,
      score: r.score,
      content: (r.payload?.content as string) ?? "",
      documentId: (r.payload?.documentId as string) ?? "",
      chunkIndex: (r.payload?.chunkIndex as number) ?? 0,
      metadata: r.payload?.metadata as Record<string, unknown> | undefined,
    }));
  }

  /**
   * Hybrid search: combine vector similarity with text match.
   */
  async hybridSearch(
    vector: number[],
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    // Use vector search with text-based reranking
    const vectorResults = await this.search(vector, limit * 2);

    // Simple keyword boosting: re-rank by text match presence
    const queryLower = query.toLowerCase();
    const reranked = vectorResults
      .map((r) => {
        const contentLower = r.content.toLowerCase();
        const hasExactMatch = queryLower.split(" ").some((word) => word.length > 2 && contentLower.includes(word));
        return {
          ...r,
          adjustedScore: hasExactMatch ? r.score * 1.2 : r.score,
        };
      })
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, limit);

    return reranked;
  }

  /**
   * Delete all vectors for a document.
   */
  async deleteByDocument(documentId: string): Promise<void> {
    await this.client.delete(this.collectionName, {
      filter: {
        must: [
          {
            key: "documentId",
            match: { value: documentId },
          },
        ],
      },
    });
  }

  async shutdown(): Promise<void> {
    // Qdrant client doesn't need explicit shutdown
  }
}
