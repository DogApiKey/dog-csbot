import { streamSimple, getEnvApiKey, Type } from "@earendil-works/pi-ai";
import type { Model, Api, Context } from "@earendil-works/pi-ai";
import type { Retriever } from "../rag/retriever.ts";
import type { ConversationService } from "../services/conversation.ts";
import type { MessageBus } from "../channels/bus.ts";
import { buildSystemPromptWithContext } from "./prompts/csbot.ts";
import type { Config } from "../config.ts";

export interface OrchestratorOptions {
  config: Config;
  retriever: Retriever;
  conversationService: ConversationService;
  messageBus: MessageBus;
}

/**
 * Simplified orchestrator that uses streamSimple directly.
 * Supports RAG via search_knowledge tool simulation.
 */
export class Orchestrator {
  private config: Config;
  private retriever: Retriever;
  private conversationService: ConversationService;
  private messageBus: MessageBus;
  private model: Model<Api>;

  constructor(options: OrchestratorOptions) {
    this.config = options.config;
    this.retriever = options.retriever;
    this.conversationService = options.conversationService;
    this.messageBus = options.messageBus;
    this.model = this.resolveModel();
  }

  private resolveModel(): Model<Api> {
    const { provider, model: modelId, baseUrl } = this.config.llm;

    if (!baseUrl) {
      // Use built-in model registry
      const { getModel } = require("@earendil-works/pi-ai");
      return getModel(provider as any, modelId);
    }

    const apiType = provider === "anthropic" ? "anthropic-messages" : "openai-completions";

    return {
      id: modelId,
      name: modelId,
      api: apiType as Api,
      provider: provider,
      baseUrl: baseUrl,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 4096,
    };
  }

  /**
   * Strip tool call syntax from LLM response.
   */
  private stripToolCalls(text: string): string {
    let cleaned = text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim();
    cleaned = cleaned.replace(/<function=[\s\S]*?<\/function>/g, "").trim();
    cleaned = cleaned.replace(/<parameter=[\s\S]*?<\/parameter>/g, "").trim();
    return cleaned;
  }

  /**
   * Process a user message with RAG support.
   */
  async processMessage(conversationId: string, userMessage: string): Promise<void> {
    // Save user message
    await this.conversationService.addMessage(conversationId, "user", userMessage);

    // Step 1: Search knowledge base
    console.log(`[orchestrator] Searching knowledge base for: ${userMessage}`);
    const searchResult = await this.retriever.retrieve(userMessage);
    const ragContext = this.retriever.formatContext(searchResult);
    console.log(`[orchestrator] Found ${searchResult.chunks.length} relevant chunks (via ${searchResult.source} search)`);

    // Step 2: Build messages with RAG context
    const history = await this.conversationService.getRecentMessages(conversationId, 20);
    const messages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: [{ type: "text" as const, text: m.content }],
      timestamp: m.createdAt.getTime(),
    }));

    // Step 3: Build system prompt with RAG context
    const systemPrompt = buildSystemPromptWithContext(ragContext);

    // Step 4: Call LLM
    const context: Context = {
      systemPrompt,
      messages,
    };

    let fullResponse = "";

    try {
      console.log(`[orchestrator] Calling LLM...`);
      const stream = streamSimple(this.model, context, {
        apiKey: this.config.llm.apiKey ?? getEnvApiKey(this.config.llm.provider),
      });

      // Process streaming events
      for await (const event of stream) {
        if (event.type === "text_delta") {
          const delta = event.delta;
          fullResponse += delta;
          await this.messageBus.publish(conversationId, JSON.stringify({
            type: "text_delta",
            data: delta,
          }));
        }
      }

      // Get final result
      const result = await stream.result();
      if (result.stopReason === "error") {
        throw new Error(result.errorMessage || "LLM error");
      }

      // Extract final text if not already captured
      if (!fullResponse) {
        const textContent = result.content.find((c: any) => c.type === "text");
        if (textContent?.text) {
          fullResponse = textContent.text;
        }
      }

      // Strip any tool call syntax that the LLM might have output
      fullResponse = this.stripToolCalls(fullResponse);

      console.log(`[orchestrator] Response length: ${fullResponse.length}`);

      // Publish completion
      await this.messageBus.publish(conversationId, JSON.stringify({
        type: "text_done",
        data: fullResponse,
      }));

      // Save assistant response
      if (fullResponse) {
        await this.conversationService.addMessage(conversationId, "assistant", fullResponse);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[orchestrator] Error: ${errorMsg}`);
      await this.messageBus.publish(conversationId, JSON.stringify({
        type: "error",
        data: errorMsg,
      }));
      throw error;
    }
  }
}
