export type AIProviderName = "gemini" | "openai" | "ollama";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionRequest = {
  messages: AIMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
};

export type AICompletionResponse = {
  content: string;
  provider: AIProviderName;
  model?: string;
};

export type AIHealthStatus = {
  provider: AIProviderName;
  configured: boolean;
  reachable: boolean;
  model?: string;
};

export class AIProviderError extends Error {
  readonly provider: AIProviderName;
  readonly model?: string;
  readonly status?: number;
  readonly code?: string;
  readonly kind:
    | "configuration"
    | "authentication"
    | "rate_limit"
    | "model_unavailable"
    | "network"
    | "malformed_response"
    | "provider_unavailable";

  constructor(options: {
    message: string;
    provider: AIProviderName;
    kind: AIProviderError["kind"];
    model?: string;
    status?: number;
    code?: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "AIProviderError";
    this.provider = options.provider;
    this.kind = options.kind;
    this.model = options.model;
    this.status = options.status;
    this.code = options.code;
  }
}

export interface AIProvider {
  readonly name: AIProviderName;
  readonly model: string;
  readonly configured: boolean;
  generate(request: AICompletionRequest): Promise<AICompletionResponse>;
  healthCheck(): Promise<AIHealthStatus>;
}