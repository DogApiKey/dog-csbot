import { Hono } from "hono";
import type { Database } from "../db/index.ts";
import { documents } from "../db/schema.ts";
import type { IngestPipeline } from "../rag/ingest.ts";
import type { ConversationService } from "../services/conversation.ts";
import { GitHubSyncService } from "../services/github-sync.ts";
import { eq, desc } from "drizzle-orm";

export interface AdminRoutesOptions {
  db: Database;
  ingestPipeline: IngestPipeline;
  conversationService: ConversationService;
}

export function createAdminRoutes(options: AdminRoutesOptions): Hono {
  const app = new Hono();
  const { db, ingestPipeline, conversationService } = options;

  const githubSyncService = new GitHubSyncService(db, ingestPipeline);

  // ─── GitHub Sync ──────────────────────────────────────────────────────────

  /**
   * POST /api/admin/sync/github
   * Sync documents from a GitHub repository.
   */
  app.post("/api/admin/sync/github", async (c) => {
    const body = await c.req.json<{
      owner: string;
      repo: string;
      branch?: string;
      path?: string;
      token?: string;
    }>();

    if (!body.owner || !body.repo) {
      return c.json({ error: "owner and repo are required" }, 400);
    }

    try {
      const result = await githubSyncService.sync({
        owner: body.owner,
        repo: body.repo,
        branch: body.branch ?? "main",
        path: body.path ?? "",
        token: body.token,
      });
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // ─── Documents ────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/documents
   * List all documents.
   */
  app.get("/api/admin/documents", async (c) => {
    const docs = await db.select().from(documents).orderBy(desc(documents.createdAt));
    return c.json({ documents: docs });
  });

  /**
   * POST /api/admin/documents
   * Upload a new document.
   */
  app.post("/api/admin/documents", async (c) => {
    const body = await c.req.json<{
      title: string;
      content: string;
      source?: string;
      metadata?: Record<string, unknown>;
    }>();

    if (!body.title?.trim() || !body.content?.trim()) {
      return c.json({ error: "Title and content are required" }, 400);
    }

    try {
      const docId = await ingestPipeline.ingest(body);
      return c.json({ id: docId, status: "processing" }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  /**
   * DELETE /api/admin/documents/:id
   * Delete a document and its vectors.
   */
  app.delete("/api/admin/documents/:id", async (c) => {
    const id = c.req.param("id");
    await ingestPipeline.delete(id);
    return c.json({ deleted: true });
  });

  /**
   * POST /api/admin/documents/:id/reindex
   * Re-index a document.
   */
  app.post("/api/admin/documents/:id/reindex", async (c) => {
    const id = c.req.param("id");
    try {
      await ingestPipeline.reindex(id);
      return c.json({ status: "reindexed" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: message }, 500);
    }
  });

  // ─── Conversations ────────────────────────────────────────────────────────

  /**
   * GET /api/admin/conversations
   * List conversations.
   */
  app.get("/api/admin/conversations", async (c) => {
    const limit = parseInt(c.req.query("limit") ?? "20", 10);
    const offset = parseInt(c.req.query("offset") ?? "0", 10);
    const channelId = c.req.query("channelId");

    const convs = await conversationService.list({ channelId, limit, offset });
    return c.json({ conversations: convs });
  });

  /**
   * GET /api/admin/conversations/:id/messages
   * Get messages for a conversation.
   */
  app.get("/api/admin/conversations/:id/messages", async (c) => {
    const id = c.req.param("id");
    const msgs = await conversationService.getMessages(id, 100);
    return c.json({ messages: msgs.reverse() });
  });

  // ─── Stats ────────────────────────────────────────────────────────────────

  /**
   * GET /api/admin/stats
   * Dashboard statistics.
   */
  app.get("/api/admin/stats", async (c) => {
    // TODO: implement proper aggregation queries
    const allDocs = await db.select().from(documents);
    const allConvs = await conversationService.list({ limit: 1000 });

    return c.json({
      documents: {
        total: allDocs.length,
        ready: allDocs.filter((d) => d.status === "ready").length,
        processing: allDocs.filter((d) => d.status === "processing").length,
        error: allDocs.filter((d) => d.status === "error").length,
      },
      conversations: {
        total: allConvs.length,
      },
    });
  });

  return app;
}
