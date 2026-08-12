import { beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "dns/promises";

vi.mock("dns/promises", () => ({
  lookup: vi.fn(),
}));

import { assertSafeSourceUrl } from "@/lib/source-service";

const mockedLookup = vi.mocked(lookup);

describe("source service SSRF protection", () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  it("rejects localhost URLs", async () => {
    await expect(assertSafeSourceUrl("http://localhost:3000/private"))
      .rejects.toThrow("Local and internal source hosts are not allowed.");
  });

  it("rejects private direct IP addresses", async () => {
    await expect(assertSafeSourceUrl("http://192.168.1.12/internal"))
      .rejects.toThrow("Private and local source IP addresses are not allowed.");
  });

  it("rejects public hostnames that resolve to private IPs", async () => {
    mockedLookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertSafeSourceUrl("https://example.com/report"))
      .rejects.toThrow("Source host resolves to a private or local network address.");
  });

  it("accepts standard public HTTPS URLs", async () => {
    mockedLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertSafeSourceUrl("https://example.com/report"))
      .resolves.toBe("https://example.com/report");
  });
});