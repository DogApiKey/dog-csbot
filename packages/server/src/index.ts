import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { loadConfig } from "./config.ts";
import { createDatabase } from "./db/index.ts";
import { MessageBus } from "./channels/bus.ts";
import { SSEManager } from "./channels/web/sse-manager.ts";
import { WebAdapter } from "./channels/web/adapter.ts";
import { Retriever, VectorSearchClient } from "./rag/retriever.ts";
import { IngestPipeline } from "./rag/ingest.ts";
import { ConversationService } from "./services/conversation.ts";
import { Orchestrator } from "./agent/orchestrator.ts";
import { createHealthRoutes } from "./api/health.ts";
import { createChatRoutes } from "./api/chat.ts";
import { createAdminRoutes } from "./api/admin.ts";

// Vector store imports (loaded conditionally)
import { VectorStore as QdrantStore } from "./rag/vector-store.ts";
import { VikingStore } from "./rag/viking-store.ts";
import { CFVectorizeStore } from "./rag/cf-vectorize-store.ts";

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

  // ─── Vector Store ───────────────────────────────────────────────────────

  let vectorStore: QdrantStore | VikingStore | CFVectorizeStore | null = null;

  if (config.vectorStore.type === "viking") {
    const { ak, sk, region, collection, indexName, vectorSize } = config.vectorStore.viking;
    if (ak && sk) {
      vectorStore = new VikingStore({ ak, sk, region, collection, indexName, vectorSize });
      await vectorStore.ensureCollection();
      console.log("[csbot] Viking DB connected");
    } else {
      console.log("[csbot] Viking DB not configured (missing VIKING_AK/VIKING_SK), using keyword search only");
    }
  } else if (config.vectorStore.type === "qdrant") {
    const { url, collectionName, vectorSize } = config.vectorStore.qdrant;
    vectorStore = new QdrantStore(url, collectionName, vectorSize);
    await vectorStore.ensureCollection();
    console.log("[csbot] Qdrant connected");
  } else if (config.vectorStore.type === "cf-vectorize") {
    const { apiUrl, apiKey } = config.vectorStore.cfVectorize;
    const cfStore = new CFVectorizeStore({ apiUrl, apiKey });
    const healthy = await cfStore.health();
    if (healthy) {
      vectorStore = cfStore;
      console.log("[csbot] Cloudflare Vectorize connected");
    } else {
      console.log("[csbot] Cloudflare Vectorize not reachable, using keyword search only");
    }
  } else {
    console.log("[csbot] No vector store configured, using keyword search only");
  }

  // ─── Services ───────────────────────────────────────────────────────────

  const conversationService = new ConversationService(db);

  // Create vector search client if CF Vectorize is configured
  let vectorClient: VectorSearchClient | undefined;
  if (config.vectorStore.cfVectorize.apiUrl) {
    vectorClient = new VectorSearchClient(
      config.vectorStore.cfVectorize.apiUrl,
      config.vectorStore.cfVectorize.apiKey || undefined,
    );
    console.log("[csbot] Vector search client configured (vector-proxy)");
  }

  const retriever = new Retriever(db, {
    topK: 5,
    vectorClient,
    vectorTimeoutMs: config.vectorSearch.timeoutMs,
  });
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
