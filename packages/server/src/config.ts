export interface Config {
  port: number;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  vectorStore: {
    /** "qdrant" | "viking" | "cf-vectorize" */
    type: string;
    qdrant: {
      url: string;
      collectionName: string;
      vectorSize: number;
    };
    viking: {
      ak: string;
      sk: string;
      region: string;
      collection: string;
      indexName: string;
      vectorSize: number;
    };
    cfVectorize: {
      apiUrl: string;
      apiKey: string;
    };
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
  vectorSearch: {
    timeoutMs: number;
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
    vectorStore: {
      type: env("VECTOR_STORE_TYPE", "cf-vectorize"),
      qdrant: {
        url: env("QDRANT_URL", "http://localhost:6333"),
        collectionName: env("QDRANT_COLLECTION", "csbot_docs"),
        vectorSize: parseInt(env("EMBEDDING_VECTOR_SIZE", "1536"), 10),
      },
      viking: {
        ak: env("VIKING_AK", ""),
        sk: env("VIKING_SK", ""),
        region: env("VIKING_REGION", "cn-beijing"),
        collection: env("VIKING_COLLECTION", "csbot_docs"),
        indexName: env("VIKING_INDEX", "csbot_docs_idx"),
        vectorSize: parseInt(env("EMBEDDING_VECTOR_SIZE", "1536"), 10),
      },
      cfVectorize: {
        apiUrl: env("CF_VECTORIZE_URL", "https://vector.orcax.net"),
        apiKey: env("CF_VECTORIZE_API_KEY", ""),
      },
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
    vectorSearch: {
      timeoutMs: parseInt(env("VECTOR_SEARCH_TIMEOUT_MS", "5000"), 10),
    },
    cors: {
      origins: env("CORS_ORIGINS", "*").split(",").map((s) => s.trim()),
    },
  };
}
