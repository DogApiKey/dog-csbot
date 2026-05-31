/**
 * Viking DB (火山引擎向量数据库) adapter for CSBot.
 *
 * Uses @volcengine/openapi SDK for Viking DB operations.
 *
 * Usage:
 *   const store = new VikingStore({ ak, sk, region, collection, indexName });
 *   await store.ensureCollection();
 *   await store.upsert([{ id, vector, payload }]);
 *   const results = await store.search(vector, 10);
 */

export interface VikingStoreOptions {
  /** 火山引擎 Access Key */
  ak: string;
  /** 火山引擎 Secret Key */
  sk: string;
  /** 区域，默认 cn-beijing */
  region?: string;
  /** Collection 名称 */
  collection: string;
  /** Index 名称 */
  indexName: string;
  /** 向量维度 */
  vectorSize: number;
  /** 主键字段名，默认 "id" */
  primaryKey?: string;
}

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

/**
 * Viking DB 向量存储适配器
 */
export class VikingStore {
  private options: Required<VikingStoreOptions>;
  private service: any; // VikingdbService instance

  constructor(options: VikingStoreOptions) {
    this.options = {
      region: "cn-beijing",
      primaryKey: "id",
      ...options,
    };
  }

  /**
   * 初始化 SDK（延迟加载，避免在不需要向量搜索时加载依赖）
   */
  private async getService() {
    if (!this.service) {
      // Dynamic import to avoid loading the SDK when not needed
      const { vikingdb } = await import("@volcengine/openapi");
      this.service = new vikingdb.VikingdbService({
        ak: this.options.ak,
        sk: this.options.sk,
        region: this.options.region,
      });
    }
    return this.service;
  }

  /**
   * 确保 Collection 和 Index 存在
   */
  async ensureCollection(): Promise<void> {
    const service = await this.getService();

    try {
      // Try to get the collection
      await service.collection.GetCollectionInfo({
        CollectionName: this.options.collection,
      });
      console.log(`[viking] Collection "${this.options.collection}" exists`);
    } catch (error: any) {
      if (error.Code === "ResourceNotFound" || error.httpStatusCode === 404) {
        // Collection doesn't exist, create it
        console.log(`[viking] Creating collection "${this.options.collection}"...`);

        await service.collection.CreateCollection({
          CollectionName: this.options.collection,
          Description: "CSBot knowledge base vectors",
          Fields: [
            {
              FieldName: this.options.primaryKey,
              FieldType: "string",
              IsPrimaryKey: true,
            },
            {
              FieldName: "documentId",
              FieldType: "string",
            },
            {
              FieldName: "chunkIndex",
              FieldType: "int64",
            },
            {
              FieldName: "content",
              FieldType: "string",
            },
          ],
          VectorIndex: {
            IndexName: this.options.indexName,
            VectorDimension: this.options.vectorSize,
            IndexType: "hnsw", // or "flat" for small datasets
            MetricType: "cosine",
          },
        });

        console.log(`[viking] Collection "${this.options.collection}" created`);
      } else {
        throw error;
      }
    }
  }

  /**
   * 插入/更新向量数据
   */
  async upsert(points: VectorPoint[]): Promise<void> {
    const service = await this.getService();

    const fields = points.map((p) => ({
      [this.options.primaryKey]: p.id,
      documentId: p.payload.documentId,
      chunkIndex: p.payload.chunkIndex,
      content: p.payload.content,
      // Vector field name depends on your collection schema
      dense_vector: p.vector,
    }));

    await service.data.UpsertData({
      CollectionName: this.options.collection,
      Fields: fields,
    });
  }

  /**
   * 向量搜索
   */
  async search(vector: number[], limit: number = 10, documentId?: string): Promise<SearchResult[]> {
    const service = await this.getService();

    const filter = documentId
      ? {
          Operation: "must" as const,
          FieldName: "documentId",
          Conditions: [documentId],
        }
      : undefined;

    const response = await service.search.SearchByVector({
      IndexName: this.options.indexName,
      DenseVectors: [vector],
      Limit: limit,
      OutputFields: ["documentId", "chunkIndex", "content"],
      Filter: filter,
    });

    // Response format: Data[0] is the results for the first query vector
    const results = response.Data?.[0] ?? [];

    return results.map((r: any) => ({
      id: r.Fields?.[this.options.primaryKey] ?? "",
      score: r.Score ?? 0,
      content: r.Fields?.content ?? "",
      documentId: r.Fields?.documentId ?? "",
      chunkIndex: r.Fields?.chunkIndex ?? 0,
      metadata: r.Fields?.metadata,
    }));
  }

  /**
   * 混合搜索（向量 + 关键词）
   */
  async hybridSearch(
    vector: number[],
    query: string,
    limit: number = 10,
  ): Promise<SearchResult[]> {
    const service = await this.getService();

    // Viking DB supports hybrid search with sparse vectors for keyword matching
    // For simplicity, we'll use vector search and then re-rank by keyword match
    const vectorResults = await this.search(vector, limit * 2);

    // Simple keyword boosting
    const queryLower = query.toLowerCase();
    const reranked = vectorResults
      .map((r) => {
        const contentLower = r.content.toLowerCase();
        const hasExactMatch = queryLower
          .split(/\s+/)
          .some((word) => word.length > 1 && contentLower.includes(word));
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
   * 删除指定文档的所有向量
   */
  async deleteByDocument(documentId: string): Promise<void> {
    const service = await this.getService();

    // First, fetch all vectors for this document
    const results = await this.search([], 1000, documentId);

    if (results.length === 0) return;

    // Delete by primary keys
    const primaryKeys = results.map((r) => r.id);

    await service.data.DeleteData({
      CollectionName: this.options.collection,
      PrimaryKeys: primaryKeys,
    });
  }

  /**
   * 清空 Collection
   */
  async clear(): Promise<void> {
    const service = await this.getService();

    await service.data.DeleteData({
      CollectionName: this.options.collection,
      DeleteAll: true,
    });
  }

  async shutdown(): Promise<void> {
    // Nothing to clean up
  }
}
