import { AIProviderError, AIProviderName } from "@/lib/ai/types";

export function normalizeProviderError(error: unknown, provider: AIProviderName, model?: string): AIProviderError {
  const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
    ? error.status
    : undefined;
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  let kind: AIProviderError["kind"] = "provider_unavailable";
  if (status === 401 || status === 403 || /api key|unauthori|forbidden|permission/i.test(message)) kind = "authentication";
  else if (status === 429 || /quota|rate limit|resource exhausted/i.test(message)) kind = "rate_limit";
  else if (status === 404 || /not found|model.*not found|unknown model/i.test(message)) kind = "model_unavailable";
  else if (/network|fetch failed|econn|socket|timed out|timeout/i.test(lower)) kind = "network";
  else if (/json|schema|malformed|invalid response/i.test(lower)) kind = "malformed_response";

  return new AIProviderError({
    message,
    provider,
    model,
    status,
    code,
    kind,
    cause: error,
  });
}

export function logProviderError(error: AIProviderError) {
  const parts = [
    "[AI] Provider request failed",
    `provider=${error.provider}`,
    error.model ? `model=${error.model}` : "",
    error.status ? `status=${error.status}` : "",
    error.code ? `code=${error.code}` : "",
    `kind=${error.kind}`,
  ].filter(Boolean);
  console.error(parts.join(" "));
}

export function toUserFacingAIError() {
  return new Error("AI service is temporarily unavailable. Please verify the configured AI provider.");
}