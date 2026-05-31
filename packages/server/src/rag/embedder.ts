import type { Config } from "../config.ts";

export interface EmbeddingResult {
  embedding: number[];
  index: number;
}

/**
 * Generate embeddings using OpenAI's embedding API.
 * This is a direct API call since pi-ai may not expose embedding endpoints.
 */
export class Embedder {
  private apiKey: string;
  private model: string;

  constructor(config: Config["embedding"]) {
    this.apiKey = config.apiKey ?? "";
    this.model = config.model;

    if (!this.apiKey) {
      throw new Error("Embedding API key is required (OPENAI_API_KEY)");
    }
  }

  /**
   * Generate embedding for a single text.
   */
  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0].embedding;
  }

  /**
   * Generate embeddings for multiple texts in a single API call.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    return data.data.sort((a, b) => a.index - b.index);
  }
}
