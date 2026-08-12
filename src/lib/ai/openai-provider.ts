import OpenAI from "openai";
import { resolveAIProviderConfig } from "@/lib/ai/config";
import { logProviderError, normalizeProviderError } from "@/lib/ai/errors";
import { AICompletionRequest, AICompletionResponse, AIHealthStatus, AIProvider, AIProviderError } from "@/lib/ai/types";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  readonly configured: boolean;
  readonly model: string;
  private readonly client?: OpenAI;

  constructor(env = process.env) {
    const config = resolveAIProviderConfig(env);
    if (config.provider !== "openai") {
      throw new AIProviderError({
        message: `OpenAI provider cannot be created from AI_PROVIDER=${config.provider}`,
        provider: "openai",
        kind: "configuration",
      });
    }

    this.model = config.model;
    this.configured = Boolean(config.apiKey);
    if (this.configured) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    }
  }

  async generate(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client || !this.configured) {
      throw new AIProviderError({
        message: "OPENAI_API_KEY is not configured.",
        provider: this.name,
        model: this.model,
        kind: "configuration",
      });
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxOutputTokens,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new AIProviderError({
          message: "OpenAI provider returned an empty response.",
          provider: this.name,
          model: this.model,
          kind: "malformed_response",
        });
      }

      return {
        content,
        provider: this.name,
        model: response.model || this.model,
      };
    } catch (error) {
      const normalized = error instanceof AIProviderError
        ? error
        : normalizeProviderError(error, this.name, this.model);
      logProviderError(normalized);
      throw normalized;
    }
  }

  async healthCheck(): Promise<AIHealthStatus> {
    if (!this.client || !this.configured) {
      return { provider: this.name, configured: false, reachable: false, model: this.model };
    }

    try {
      const result = await this.generate({
        messages: [{ role: "user", content: "Reply with exactly: AI_CONNECTION_OK" }],
        maxOutputTokens: 32,
      });
      return { provider: this.name, configured: true, reachable: result.content === "AI_CONNECTION_OK", model: result.model || this.model };
    } catch {
      return { provider: this.name, configured: true, reachable: false, model: this.model };
    }
  }
}