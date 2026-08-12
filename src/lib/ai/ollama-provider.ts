import { resolveAIProviderConfig } from "@/lib/ai/config";
import { AICompletionResponse, AIHealthStatus, AIProvider, AIProviderError } from "@/lib/ai/types";

export class OllamaProvider implements AIProvider {
  readonly name = "ollama" as const;
  readonly configured: boolean;
  readonly model: string;
  readonly baseURL: string;

  constructor(env = process.env) {
    const config = resolveAIProviderConfig(env);
    if (config.provider !== "ollama") {
      throw new AIProviderError({
        message: `Ollama provider cannot be created from AI_PROVIDER=${config.provider}`,
        provider: "ollama",
        kind: "configuration",
      });
    }

    this.model = config.model;
    this.baseURL = config.baseURL;
    this.configured = Boolean(config.baseURL);
  }

  async generate(): Promise<AICompletionResponse> {
    throw new AIProviderError({
      message: "Ollama provider is not implemented in this sprint.",
      provider: this.name,
      model: this.model,
      kind: "configuration",
    });
  }

  async healthCheck(): Promise<AIHealthStatus> {
    return {
      provider: this.name,
      configured: this.configured,
      reachable: false,
      model: this.model,
    };
  }
}