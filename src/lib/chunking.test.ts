import { describe, expect, it } from "vitest";
import { chunkText, rankChunks } from "@/lib/chunking";

describe("chunkText", () => {
  it("splits long content and preserves all major text regions", () => {
    const text = `${"Planning evidence sentence. ".repeat(80)}${"Transport context sentence. ".repeat(80)}`;
    const chunks = chunkText(text, 500, 50);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks[0]).toContain("Planning evidence");
    expect(chunks.at(-1)).toContain("Transport context");
  });

  it("returns no chunks for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("rankChunks", () => {
  it("prioritizes chunks with matching section terms", () => {
    const result = rankChunks("legal planning approval", [
      "The market has several retail properties.",
      "The legal planning approval was issued by the authority.",
    ], 1);
    expect(result[0]).toContain("legal planning approval");
  });
});
