import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAIProviderConfig, resolveAIProviderName } from "@/lib/ai/config";
import { normalizeProviderError } from "@/lib/ai/errors";
import { GeminiAIProvider, geminiTemperatureFromCreativity } from "@/lib/ai/gemini-provider";
import { parseJsonText } from "@/lib/ai/json";
import { getAIProvider } from "@/lib/ai/provider-factory";

const generateContent = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent,
    },
  })),
}));

describe("ai provider factory", () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it("defaults to gemini provider", () => {
    expect(resolveAIProviderName({})).toBe("gemini");
    expect(getAIProvider({ GEMINI_API_KEY: "test-key" }).name).toBe("gemini");
  });

  it("rejects invalid AI_PROVIDER values", () => {
    expect(() => resolveAIProviderName({ AI_PROVIDER: "retired-github" })).toThrow("Unsupported AI_PROVIDER");
  });

  it("maps Gemini config from environment", () => {
    expect(resolveAIProviderConfig({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.5-flash" })).toEqual({
      provider: "gemini",
      apiKey: "abc",
      model: "gemini-2.5-flash",
    });
  });

  it("maps creativity safely for Gemini temperature", () => {
    expect(geminiTemperatureFromCreativity(undefined)).toBeUndefined();
    expect(geminiTemperatureFromCreativity(-1)).toBe(0);
    expect(geminiTemperatureFromCreativity(0.5)).toBe(0.5);
    expect(geminiTemperatureFromCreativity(4)).toBe(1);
  });

  it("normalizes Gemini responses", async () => {
    generateContent.mockResolvedValue({ text: "AI_CONNECTION_OK", modelVersion: "gemini-2.5-flash" });
    const provider = new GeminiAIProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.5-flash" });
    const result = await provider.generate({
      messages: [{ role: "user", content: "Reply with exactly: AI_CONNECTION_OK" }],
    });
    expect(result).toEqual({
      content: "AI_CONNECTION_OK",
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  });

  it("fails clearly when the Gemini API key is missing", async () => {
    const provider = new GeminiAIProvider({ AI_PROVIDER: "gemini", GEMINI_MODEL: "gemini-2.5-flash" });
    await expect(provider.generate({ messages: [{ role: "user", content: "Hi" }] })).rejects.toMatchObject({
      name: "AIProviderError",
      kind: "configuration",
    });
  });

  it("reports health from the provider layer", async () => {
    generateContent.mockResolvedValue({ text: "AI_CONNECTION_OK", modelVersion: "gemini-2.5-flash" });
    const provider = new GeminiAIProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.5-flash" });
    await expect(provider.healthCheck()).resolves.toEqual({
      provider: "gemini",
      configured: true,
      reachable: true,
      model: "gemini-2.5-flash",
    });
  });

  it("normalizes provider failures", () => {
    const error = normalizeProviderError({ status: 429, message: "quota exceeded" }, "gemini", "gemini-2.5-flash");
    expect(error.kind).toBe("rate_limit");
    expect(error.status).toBe(429);
  });

  it("parses structured JSON defensively", () => {
    expect(parseJsonText<{ content: string }>("before {\"content\":\"ok\"} after")).toEqual({ content: "ok" });
  });

  it("passes schema and generation settings to Gemini", async () => {
    generateContent.mockResolvedValue({ text: '{"content":"ok"}', modelVersion: "gemini-2.5-flash" });
    const provider = new GeminiAIProvider({ AI_PROVIDER: "gemini", GEMINI_API_KEY: "abc", GEMINI_MODEL: "gemini-2.5-flash" });
    await provider.generate({
      messages: [
        { role: "system", content: "System" },
        { role: "user", content: "User" },
      ],
      temperature: 0.4,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
      responseSchema: { type: "object" },
    });

    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-2.5-flash",
      contents: "USER: User",
      config: expect.objectContaining({
        systemInstruction: "System",
        thinkingConfig: {
          thinkingBudget: 0,
        },
        temperature: 0.4,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
        responseJsonSchema: { type: "object" },
      }),
    }));
  });
});