import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import type { Database } from "../db/index.ts";
import { documents, documentChunks } from "../db/schema.ts";
import { chunkDocument } from "./chunker.ts";

export interface IngestOptions {
  title: string;
  content: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Document ingestion pipeline (keyword search version):
 * 1. Store document in PostgreSQL
 * 2. Chunk the content
 * 3. Store chunks in PostgreSQL for full-text search
 */
export class IngestPipeline {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Ingest a single document.
   */
  async ingest(options: IngestOptions): Promise<string> {
    // 1. Store document in PostgreSQL
    const [doc] = await this.db
      .insert(documents)
      .values({
        title: options.title,
        content: options.content,
        source: options.source,
        metadata: options.metadata ?? {},
        status: "processing",
      })
      .returning();

    try {
      // 2. Chunk the content
      const chunks = chunkDocument(options.content);

      if (chunks.length === 0) {
        await this.db
          .update(documents)
          .set({ status: "error", errorMessage: "No content to chunk" })
          .where(eq(documents.id, doc.id));
        return doc.id;
      }

      // 3. Store chunks in PostgreSQL
      await this.db.insert(documentChunks).values(
        chunks.map((chunk) => ({
          documentId: doc.id,
          chunkIndex: chunk.index,
          content: chunk.content,
          vectorId: uuidv4(), // placeholder for future vector search
        })),
      );

      // Update document status
      await this.db
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(documents.id, doc.id));

      return doc.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.db
        .update(documents)
        .set({ status: "error", errorMessage: message, updatedAt: new Date() })
        .where(eq(documents.id, doc.id));
      throw error;
    }
  }

  /**
   * Re-index a document (delete old chunks, re-chunk).
   */
  async reindex(documentId: string): Promise<void> {
    const [doc] = await this.db.select().from(documents).where(eq(documents.id, documentId)).limit(1);

    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Delete old chunks
    await this.db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

    // Re-ingest
    await this.ingest({
      title: doc.title,
      content: doc.content,
      source: doc.source ?? undefined,
      metadata: doc.metadata as Record<string, unknown> | undefined,
    });
  }

  /**
   * Delete a document and all its chunks.
   */
  async delete(documentId: string): Promise<void> {
    await this.db.delete(documents).where(eq(documents.id, documentId));
  }
}
