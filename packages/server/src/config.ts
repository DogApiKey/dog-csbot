export interface Config {
  port: number;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  qdrant: {
    url: string;
    collectionName: string;
    vectorSize: number;
  };
  llm: {
    provider: string;
    model: string;
    apiKey?: string;
    baseUrl?: string;
  };
  embedding: {
    model: string;
    apiKey?: string;
    vectorSize: number;
  };
  cors: {
    origins: string[];
  };
}

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    port: parseInt(env("PORT", "3000"), 10),
    database: {
      url: env("DATABASE_URL", "postgres://csbot:csbot@localhost:5432/csbot"),
    },
    redis: {
      url: env("REDIS_URL", "redis://localhost:6379"),
    },
    qdrant: {
      url: env("QDRANT_URL", "http://localhost:6333"),
      collectionName: env("QDRANT_COLLECTION", "csbot_docs"),
      vectorSize: parseInt(env("EMBEDDING_VECTOR_SIZE", "1536"), 10),
    },
    llm: {
      provider: env("LLM_PROVIDER", "openai"),
      model: env("LLM_MODEL", "mimo-v2.5-pro"),
      apiKey: process.env.LLM_API_KEY,
      baseUrl: process.env.LLM_BASE_URL,
    },
    embedding: {
      model: env("EMBEDDING_MODEL", "text-embedding-3-small"),
      apiKey: process.env.OPENAI_API_KEY,
      vectorSize: parseInt(env("EMBEDDING_VECTOR_SIZE", "1536"), 10),
    },
    cors: {
      origins: env("CORS_ORIGINS", "*").split(",").map((s) => s.trim()),
    },
  };
}
