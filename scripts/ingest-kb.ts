#!/usr/bin/env bun
/**
 * Ingest knowledge base documents into Cloudflare Vectorize
 *
 * Usage:
 *   bun run scripts/ingest-kb.ts
 *
 * Environment variables:
 *   CF_VECTORIZE_URL     - Vector proxy URL (default: https://vector.orcax.net)
 *   CF_VECTORIZE_API_KEY - API key for authentication (optional)
 *   EMBEDDING_PROVIDER   - "ollama" | "openai" (default: ollama)
 *   OLLAMA_URL           - Ollama URL (default: http://localhost:11434)
 *   OLLAMA_MODEL         - Ollama embedding model (default: qwen3-embedding:8b)
 *   EMBEDDING_DIMENSIONS - Output dimensions (default: 1024)
 *   OPENAI_API_KEY       - OpenAI API key (if using openai)
 *   OPENAI_BASE_URL      - OpenAI API base URL (default: https://api.openai.com/v1)
 *   EMBEDDING_MODEL      - OpenAI embedding model (default: text-embedding-3-small)
 *   KB_REPO_PATH         - Path to knowledge base repo (default: ../dogapi-kb)
 */

const CF_VECTORIZE_URL = process.env.CF_VECTORIZE_URL || "https://vector.orcax.net";
const CF_VECTORIZE_API_KEY = process.env.CF_VECTORIZE_API_KEY || "";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "ollama";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3-embedding:8b";
const EMBEDDING_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS || "1024");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const KB_REPO_PATH = process.env.KB_REPO_PATH || "../dogapi-kb";

interface VectorPoint {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

// ─── File Discovery ──────────────────────────────────────────────────────────

import { readdirSync, statSync } from "node:fs";

function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = `${currentDir}/${entry.name}`;
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// ─── Chunking ────────────────────────────────────────────────────────────────

function chunkText(text: string, maxChars: number = 2000, overlap: number = 200): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    if (end < text.length) {
      const chunk = text.slice(start, end);
      const breakPoints = ["\n\n", "\n", ". ", "。", "！", "？", "；"];

      let bestBreak = -1;
      for (const bp of breakPoints) {
        const idx = chunk.lastIndexOf(bp);
        if (idx > maxChars * 0.3 && idx > bestBreak) {
          bestBreak = idx + bp.length;
        }
      }

      if (bestBreak > 0) {
        end = start + bestBreak;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push(content);
    }

    // Ensure progress: move start forward by at least 1
    const nextStart = end - overlap;
    if (nextStart <= start) {
      start = end; // Force progress
    } else {
      start = nextStart;
    }
  }

  return chunks;
}

// ─── Embedding (Ollama) ─────────────────────────────────────────────────────

async function ollamaEmbed(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as { embedding: number[] };

  // Truncate to target dimensions
  if (data.embedding.length > EMBEDDING_DIMENSIONS) {
    return data.embedding.slice(0, EMBEDDING_DIMENSIONS);
  }

  return data.embedding;
}

async function ollamaEmbedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  const startTime = Date.now();

  for (let i = 0; i < texts.length; i++) {
    const chunkStart = Date.now();
    embeddings.push(await ollamaEmbed(texts[i]));
    const chunkTime = Date.now() - chunkStart;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const eta = ((texts.length - i - 1) * chunkTime / 1000).toFixed(0);

    process.stdout.write(`\r  ⏳ Embedding ${i + 1}/${texts.length} | ${chunkTime}ms/chunk | ${elapsed}s elapsed | ~${eta}s remaining`);
  }

  console.log(""); // New line after progress
  return embeddings;
}

// ─── Embedding (OpenAI) ─────────────────────────────────────────────────────

async function openaiEmbed(text: string): Promise<number[]> {
  const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
  };

  return data.data[0].embedding;
}

async function openaiEmbedBatch(texts: string[]): Promise<number[][]> {
  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await fetch(`${OPENAI_BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    const sorted = data.data.sort((a, b) => a.index - b.index);
    embeddings.push(...sorted.map((d) => d.embedding));

    console.log(`  Embedded ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`);

    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return embeddings;
}

// ─── Embedding Router ────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  if (EMBEDDING_PROVIDER === "ollama") {
    return ollamaEmbed(text);
  }
  return openaiEmbed(text);
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (EMBEDDING_PROVIDER === "ollama") {
    return ollamaEmbedBatch(texts);
  }
  return openaiEmbedBatch(texts);
}

// ─── Vectorize API ───────────────────────────────────────────────────────────

const vectorizeHeaders: Record<string, string> = {
  "Content-Type": "application/json",
  ...(CF_VECTORIZE_API_KEY ? { Authorization: `Bearer ${CF_VECTORIZE_API_KEY}` } : {}),
};

async function upsertVectors(vectors: VectorPoint[]): Promise<void> {
  const response = await fetch(`${CF_VECTORIZE_URL}/upsert`, {
    method: "POST",
    headers: vectorizeHeaders,
    body: JSON.stringify({ vectors }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upsert failed (${response.status}): ${error}`);
  }
}

async function getVectorCount(): Promise<number> {
  try {
    const response = await fetch(`${CF_VECTORIZE_URL}/describe`, {
      headers: vectorizeHeaders,
    });

    if (!response.ok) return 0;

    const data = (await response.json()) as { vectorsCount?: number };
    return data.vectorsCount || 0;
  } catch {
    return 0;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📚 Knowledge Base Ingestion");
  console.log("==========================");
  console.log(`Embedding: ${EMBEDDING_PROVIDER} (${EMBEDDING_DIMENSIONS}d)`);
  console.log(`Vectorize: ${CF_VECTORIZE_URL}\n`);

  // Check Vectorize connection
  console.log("🔍 Checking Vectorize connection...");
  try {
    const healthResponse = await fetch(`${CF_VECTORIZE_URL}/health`);
    if (!healthResponse.ok) throw new Error("Health check failed");
    console.log("✅ Vectorize connected\n");
  } catch {
    console.error(`❌ Cannot reach Vectorize at ${CF_VECTORIZE_URL}`);
    process.exit(1);
  }

  // Check Ollama connection
  if (EMBEDDING_PROVIDER === "ollama") {
    console.log("🔍 Checking Ollama connection...");
    try {
      const response = await fetch(`${OLLAMA_URL}/api/tags`);
      if (!response.ok) throw new Error("Ollama not responding");
      console.log("✅ Ollama connected\n");
    } catch {
      console.error(`❌ Cannot reach Ollama at ${OLLAMA_URL}`);
      console.log("Make sure Ollama is running: ollama serve");
      process.exit(1);
    }
  }

  // Find knowledge base files (only public/ and guides/)
  console.log("📁 Scanning knowledge base...");
  const allFiles = findMarkdownFiles(KB_REPO_PATH);
  const files = allFiles.filter(f => {
    const relative = f.replace(KB_REPO_PATH + "/", "");
    return relative.startsWith("public/") || relative.startsWith("guides/");
  });
  const skipped = allFiles.length - files.length;
  console.log(`Found ${files.length} user-facing docs (${skipped} internal docs skipped)\n`);

  if (files.length === 0) {
    console.log("No files found. Make sure KB_REPO_PATH is correct.");
    process.exit(0);
  }

  // Process each file
  let totalChunks = 0;
  let totalVectors = 0;
  const totalStartTime = Date.now();

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const relativePath = file.replace(KB_REPO_PATH + "/", "");
    console.log(`\n📄 [${fileIdx + 1}/${files.length}] ${relativePath}`);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(file, "utf-8");

    if (content.trim().length < 50) {
      console.log("  ⏭️  Skipped (too short)");
      continue;
    }

    const chunks = chunkText(content);
    console.log(`  📝 ${chunks.length} chunks (${(content.length / 1024).toFixed(1)}KB)`);

    // Embed
    const embedStart = Date.now();
    const embeddings = await generateEmbeddings(chunks);
    const embedTime = ((Date.now() - embedStart) / 1000).toFixed(1);
    console.log(`  🧠 Embedded in ${embedTime}s`);

    // Prepare vectors
    const vectors: VectorPoint[] = chunks.map((chunk, i) => ({
      id: `${relativePath}:${i}`,
      values: embeddings[i],
      metadata: {
        source: relativePath,
        chunkIndex: i,
        content: chunk,
      },
    }));

    // Upload in batches
    const uploadStart = Date.now();
    for (let i = 0; i < vectors.length; i += 100) {
      const batch = vectors.slice(i, i + 100);
      await upsertVectors(batch);
      process.stdout.write(`\r  ☁️  Uploaded ${Math.min(i + 100, vectors.length)}/${vectors.length} vectors`);
    }
    console.log("");

    const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(1);
    totalChunks += chunks.length;
    totalVectors += vectors.length;
    console.log(`  ✅ Done (${uploadTime}s upload)`);

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const totalTime = ((Date.now() - totalStartTime) / 1000).toFixed(1);

  // Summary
  console.log("\n==========================");
  console.log(`✅ Ingestion complete!`);
  console.log(`   Files: ${files.length}`);
  console.log(`   Chunks: ${totalChunks}`);
  console.log(`   Vectors: ${totalVectors}`);
  console.log(`   Time: ${totalTime}s`);

  const count = await getVectorCount();
  console.log(`   Vectorize count: ${count}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
