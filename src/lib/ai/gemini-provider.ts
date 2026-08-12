import { GoogleGenAI } from "@google/genai";
import { resolveAIProviderConfig } from "@/lib/ai/config";
import { logProviderError, normalizeProviderError } from "@/lib/ai/errors";
import { AICompletionRequest, AICompletionResponse, AIHealthStatus, AIProvider, AIProviderError } from "@/lib/ai/types";

export function geminiTemperatureFromCreativity(temperature?: number) {
  if (!Number.isFinite(temperature)) return undefined;
  return Math.min(1, Math.max(0, temperature as number));
}

export class GeminiAIProvider implements AIProvider {
  readonly name = "gemini" as const;
  readonly configured: boolean;
  readonly model: string;
  private readonly client?: GoogleGenAI;

  constructor(env = process.env) {
    const config = resolveAIProviderConfig(env);
    if (config.provider !== "gemini") {
      throw new AIProviderError({
        message: `Gemini provider cannot be created from AI_PROVIDER=${config.provider}`,
        provider: "gemini",
        kind: "configuration",
      });
    }

    this.model = config.model;
    this.configured = Boolean(config.apiKey);
    if (this.configured) {
      this.client = new GoogleGenAI({ apiKey: config.apiKey });
    }
  }

  async generate(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.client || !this.configured) {
      throw new AIProviderError({
        message: "GEMINI_API_KEY is not configured.",
        provider: this.name,
        model: this.model,
        kind: "configuration",
      });
    }

    const { systemInstruction, userInput } = splitMessages(request.messages);

    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: userInput,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingBudget: 0,
          },
          temperature: geminiTemperatureFromCreativity(request.temperature),
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType: request.responseMimeType,
          responseJsonSchema: request.responseSchema,
        },
      });

      const content = response.text?.trim();
      if (!content) {
        throw new AIProviderError({
          message: "Gemini returned an empty response.",
          provider: this.name,
          model: this.model,
          kind: "malformed_response",
        });
      }

      return {
        content,
        provider: this.name,
        model: response.modelVersion || this.model,
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
      return {
        provider: this.name,
        configured: false,
        reachable: false,
        model: this.model,
      };
    }

    try {
      const result = await this.generate({
        messages: [{ role: "user", content: "Reply with exactly: AI_CONNECTION_OK" }],
        maxOutputTokens: 128,
      });
      return {
        provider: this.name,
        configured: true,
        reachable: result.content === "AI_CONNECTION_OK",
        model: result.model || this.model,
      };
    } catch {
      return {
        provider: this.name,
        configured: true,
        reachable: false,
        model: this.model,
      };
    }
  }
}

function splitMessages(messages: AICompletionRequest["messages"]) {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const userInput = messages
    .filter((message) => message.role !== "system")
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  return {
    systemInstruction: systemInstruction || undefined,
    userInput,
  };
}