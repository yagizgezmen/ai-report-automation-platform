import { AIProviderName } from "@/lib/ai/types";

export type AIProviderConfig =
  | {
    provider: "gemini";
    apiKey: string;
    model: string;
  }
  | {
    provider: "openai";
    apiKey: string;
    model: string;
    baseURL?: string;
  }
  | {
    provider: "ollama";
    model: string;
    baseURL: string;
  };

const DEFAULT_PROVIDER: AIProviderName = "gemini";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1";

export function resolveAIProviderName(env = process.env): AIProviderName {
  const value = env.AI_PROVIDER?.trim().toLowerCase();
  if (!value) return DEFAULT_PROVIDER;
  if (value === "gemini" || value === "openai" || value === "ollama") return value;
  throw new Error(`Unsupported AI_PROVIDER: ${env.AI_PROVIDER}`);
}

export function resolveAIProviderConfig(env = process.env): AIProviderConfig {
  const provider = resolveAIProviderName(env);

  if (provider === "gemini") {
    return {
      provider,
      apiKey: env.GEMINI_API_KEY?.trim() || "",
      model: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    };
  }

  if (provider === "openai") {
    return {
      provider,
      apiKey: env.OPENAI_API_KEY?.trim() || "",
      model: env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
      baseURL: env.OPENAI_BASE_URL?.trim() || undefined,
    };
  }

  return {
    provider,
    model: env.OLLAMA_MODEL?.trim() || "llama3.1",
    baseURL: env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL,
  };
}