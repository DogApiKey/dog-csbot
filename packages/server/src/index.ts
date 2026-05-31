import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./db/index.ts";
import { MessageBus } from "./channels/bus.ts";
import { SSEManager } from "./channels/web/sse-manager.ts";
import { WebAdapter } from "./channels/web/adapter.ts";
import { Retriever } from "./rag/retriever.ts";
import { IngestPipeline } from "./rag/ingest.ts";
import { ConversationService } from "./services/conversation.ts";
import { Orchestrator } from "./agent/orchestrator.ts";
import { createHealthRoutes } from "./api/health.ts";
import { createChatRoutes } from "./api/chat.ts";
import { createAdminRoutes } from "./api/admin.ts";

async function main() {
  const config = loadConfig();

  console.log("[csbot] Starting server...");
  console.log(`[csbot] Port: ${config.port}`);
  console.log(`[csbot] LLM: ${config.llm.provider}/${config.llm.model}`);

  // ─── Infrastructure ─────────────────────────────────────────────────────

  const db = createDatabase(config.database.url);
  console.log("[csbot] Database connected");

  const messageBus = new MessageBus(config.redis.url);
  console.log("[csbot] Redis connected");

  // ─── Services ───────────────────────────────────────────────────────────

  const conversationService = new ConversationService(db);

  const retriever = new Retriever(db, 5);
  const ingestPipeline = new IngestPipeline(db);

  // ─── Channel Adapters ───────────────────────────────────────────────────

  const sseManager = new SSEManager(messageBus);
  const webAdapter = new WebAdapter(sseManager, messageBus);
  await webAdapter.init();

  // ─── Agent Orchestrator ─────────────────────────────────────────────────

  const orchestrator = new Orchestrator({
    config,
    retriever,
    conversationService,
    messageBus,
  });

  // Register message handler
  webAdapter.onMessage(async (msg) => {
    await orchestrator.processMessage(msg.conversationId, msg.content);
  });

  // ─── HTTP Server ────────────────────────────────────────────────────────

  const app = new Hono();

  // Middleware
  app.use("*", logger());

  // CORS middleware - manual implementation for better control
  app.use("*", async (c, next) => {
    const origin = c.req.header("Origin") || "*";

    // Handle preflight
    if (c.req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        },
      });
    }

    // Add CORS headers to response
    await next();

    c.res.headers.set("Access-Control-Allow-Origin", origin);
    c.res.headers.set("Vary", "Origin");
  });

  // Routes
  app.route("/", createHealthRoutes());
  app.route(
    "/",
    createChatRoutes({ webAdapter, orchestrator, conversationService }),
  );
  app.route(
    "/",
    createAdminRoutes({ db, ingestPipeline, conversationService }),
  );

  // ─── Start ──────────────────────────────────────────────────────────────

  const server = Bun.serve({
    port: config.port,
    fetch: app.fetch,
  });

  console.log(`[csbot] Server running on http://localhost:${server.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[csbot] Shutting down...");
    server.stop();
    await sseManager.shutdown();
    await webAdapter.shutdown();
    await messageBus.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[csbot] Fatal error:", err);
  process.exit(1);
});
