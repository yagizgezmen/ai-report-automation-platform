import { resolveAIProviderName } from "@/lib/ai/config";
import { GeminiAIProvider } from "@/lib/ai/gemini-provider";
import { OllamaProvider } from "@/lib/ai/ollama-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import { AIProvider } from "@/lib/ai/types";

export function getAIProvider(env = process.env): AIProvider {
  const provider = resolveAIProviderName(env);
  if (provider === "gemini") return new GeminiAIProvider(env);
  if (provider === "openai") return new OpenAIProvider(env);
  return new OllamaProvider(env);
}