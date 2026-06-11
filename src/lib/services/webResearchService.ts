import * as cheerio from "cheerio/slim";
import { collectSource } from "@/lib/source-service";
import { Report, ReportSection, Source } from "@/lib/types";

export interface WebResearchRequest {
  report: Report;
  section: ReportSection;
  instruction?: string;
}

type ResearchCandidate = {
  url: string;
  query: string;
  score: number;
};

const NATIONAL_TRUSTED_URLS = [
  "https://www.tuik.gov.tr/",
  "https://www.resmigazete.gov.tr/",
  "https://www.mevzuat.gov.tr/",
  "https://www.csb.gov.tr/",
];

export function buildWebResearchQueries(report: Report, section: ReportSection): string[] {
  const [city = "", district = "", neighborhood = ""] = report.location.split("/").map((item) => item.trim());
  const area = [neighborhood, district, city].filter(Boolean).join(" ");
  const parcel = report.parcelInfo?.trim();
  const parts = [
    `${report.reportType} ${section.title} ${area}`.trim(),
    `${section.title} ${city} ${district} ${neighborhood} ${parcel || ""}`.trim(),
    `${report.reportType} ${city} ${district} official statistics`.trim(),
    `${report.reportType} ${city} ${district} municipality zoning plan`.trim(),
    `${report.reportType} ${city} ${district} legal administrative background`.trim(),
    `${section.title} ${parcel || ""} ${city} ${district}`.trim(),
  ];
  return [...new Set(parts.map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))];
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function normalizeUrl(input: string) {
  const url = new URL(input);
  url.hash = "";
  return url.toString();
}

function hostTrustScore(url: string) {
  const hostname = new URL(url).hostname.toLocaleLowerCase("en-US");
  if (/\.(gov|gov\.tr|bel\.tr)(\.|$)/.test(hostname)) return 6;
  if (hostname.includes("tuik.gov.tr") || hostname.includes("resmigazete.gov.tr") || hostname.includes("mevzuat.gov.tr")) return 7;
  if (hostname.includes(".edu") || hostname.includes(".org")) return 2;
  return 0;
}

function keywordScore(url: string, queries: string[]) {
  const haystack = decodeURIComponent(url).toLocaleLowerCase("tr");
  return queries.reduce((score, query) => {
    const tokens = query.toLocaleLowerCase("tr").split(/\s+/).filter((item) => item.length > 3);
    return score + tokens.filter((token) => haystack.includes(token)).length;
  }, 0);
}

function buildOfficialCandidates(report: Report, queries: string[]): ResearchCandidate[] {
  const [city = "", district = ""] = report.location.split("/").map((item) => item.trim());
  const citySlug = slugify(city);
  const districtSlug = slugify(district);
  const candidateUrls = [
    ...NATIONAL_TRUSTED_URLS,
    citySlug ? `https://www.${citySlug}.bel.tr/` : "",
    citySlug ? `https://www.${citySlug}.gov.tr/` : "",
    districtSlug ? `https://www.${districtSlug}.bel.tr/` : "",
  ].filter(Boolean);

  return candidateUrls.map((url, index) => ({
    url,
    query: queries[index % queries.length] || queries[0] || report.reportType,
    score: hostTrustScore(url) + keywordScore(url, queries),
  }));
}

async function discoverLinkedCandidates(seedUrl: string, queries: string[]): Promise<ResearchCandidate[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(seedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ArqiveAI-WebResearch/1.0" },
    });
    if (!response.ok) return [];
    const html = await response.text();
    const $ = cheerio.load(html);
    const candidates = $("a[href]").toArray().flatMap((node) => {
      const href = $(node).attr("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return [];
      try {
        const absolute = normalizeUrl(new URL(href, seedUrl).toString());
        if (!/^https?:\/\//.test(absolute)) return [];
        if (absolute.endsWith(".pdf") || absolute.includes("/iletisim") || absolute.includes("/contact")) return [];
        const score = hostTrustScore(absolute) + keywordScore(absolute, queries);
        if (score < 5) return [];
        return [{
          url: absolute,
          query: queries.find((query) => keywordScore(absolute, [query]) > 0) || queries[0] || seedUrl,
          score,
        }];
      } catch {
        return [];
      }
    });
    return candidates;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function researchWeb(
  request: WebResearchRequest,
): Promise<Source[]> {
  if (!request.report.allowWebResearch) return [];

  const queries = buildWebResearchQueries(request.report, request.section);
  const existingUrls = new Set(request.report.sources.map((source) => normalizeUrl(source.url)));
  const candidateMap = new Map<string, ResearchCandidate>();
  const seedUrls = request.report.sources
    .filter((source) => source.origin !== "ai-discovered")
    .sort((left, right) => Number(right.isOfficial) - Number(left.isOfficial))
    .slice(0, 4)
    .map((source) => source.url);

  for (const candidate of buildOfficialCandidates(request.report, queries)) {
    if (existingUrls.has(normalizeUrl(candidate.url))) continue;
    candidateMap.set(candidate.url, candidate);
  }

  const linkedGroups = await Promise.all(seedUrls.map((url) => discoverLinkedCandidates(url, queries)));
  for (const candidate of linkedGroups.flat()) {
    if (existingUrls.has(normalizeUrl(candidate.url))) continue;
    const current = candidateMap.get(candidate.url);
    if (!current || current.score < candidate.score) candidateMap.set(candidate.url, candidate);
  }

  const prioritized = [...candidateMap.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  const results = await Promise.allSettled(
    prioritized.map((candidate) => collectSource(candidate.url, {
      origin: "ai-discovered",
      searchQuery: candidate.query,
    })),
  );

  return results
    .filter((result): result is PromiseFulfilledResult<Source> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((source) => !existingUrls.has(normalizeUrl(source.url)))
    .sort((left, right) => Number(right.isOfficial) - Number(left.isOfficial));
}
