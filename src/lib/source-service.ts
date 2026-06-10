import * as cheerio from "cheerio";
import { randomUUID } from "crypto";
import { Source, SourceOrigin } from "@/lib/types";

type CollectSourceOptions = {
  origin?: SourceOrigin;
  searchQuery?: string;
};

export async function collectSource(url: string, options: CollectSourceOptions = {}): Promise<Source> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "ArqiveAI-SourceCollector/1.0" },
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, form, noscript, svg").remove();
    const title = $("title").first().text().trim() || new URL(url).hostname;
    const content = ($("main, article").first().text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, 120000);
    if (content.length < 50) throw new Error("No readable page content was found.");
    const hostname = new URL(url).hostname.toLowerCase();
    return {
      id: randomUUID(),
      title,
      url,
      fetchedAt: new Date().toISOString(),
      content,
      isOfficial: /\.(gov|gov\.tr|bel\.tr|edu)(\.|$)/.test(hostname),
      origin: options.origin || "manual",
      searchQuery: options.searchQuery,
    };
  } finally {
    clearTimeout(timeout);
  }
}
