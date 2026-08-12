import * as cheerio from "cheerio";
import { randomUUID } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { Source, SourceOrigin } from "@/lib/types";

type CollectSourceOptions = {
  origin?: SourceOrigin;
  searchQuery?: string;
};

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "host.docker.internal",
]);

function ipv4ToNumber(ip: string) {
  return ip.split(".").reduce((value, part) => (value << 8) + Number(part), 0);
}

function isBlockedIpv4(ip: string) {
  const value = ipv4ToNumber(ip);
  const inRange = (start: string, end: string) => value >= ipv4ToNumber(start) && value <= ipv4ToNumber(end);
  return inRange("0.0.0.0", "0.255.255.255")
    || inRange("10.0.0.0", "10.255.255.255")
    || inRange("127.0.0.0", "127.255.255.255")
    || inRange("169.254.0.0", "169.254.255.255")
    || inRange("172.16.0.0", "172.31.255.255")
    || inRange("192.168.0.0", "192.168.255.255")
    || inRange("224.0.0.0", "255.255.255.255");
}

function isBlockedIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return normalized === "::1"
    || normalized === "::"
    || normalized.startsWith("fe80:")
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || normalized.startsWith("::ffff:127.")
    || normalized.startsWith("::ffff:10.")
    || normalized.startsWith("::ffff:192.168.")
    || /^::ffff:172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
    || normalized.startsWith("::ffff:169.254.");
}

function isBlockedIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return false;
}

export async function assertSafeSourceUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Source URL is invalid.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS source URLs are allowed.");
  }

  if (url.username || url.password) {
    throw new Error("Source URLs with embedded credentials are not allowed.");
  }

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Local and internal source hosts are not allowed.");
  }

  if (isBlockedIpAddress(hostname)) {
    throw new Error("Private and local source IP addresses are not allowed.");
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length) {
    throw new Error("Source host could not be resolved.");
  }
  if (resolved.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error("Source host resolves to a private or local network address.");
  }

  return url.toString();
}

async function fetchWithSafeRedirects(input: string, init: RequestInit = {}, redirectLimit = 3): Promise<Response> {
  let currentUrl = await assertSafeSourceUrl(input);

  for (let attempt = 0; attempt <= redirectLimit; attempt += 1) {
    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Source redirect location is missing.");
    }
    currentUrl = await assertSafeSourceUrl(new URL(location, currentUrl).toString());
  }

  throw new Error("Source request exceeded the maximum redirect limit.");
}

export async function collectSource(url: string, options: CollectSourceOptions = {}): Promise<Source> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const safeUrl = await assertSafeSourceUrl(url);
    const response = await fetchWithSafeRedirects(safeUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "ArqiveAI-SourceCollector/1.0" },
    });
    if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, form, noscript, svg").remove();
    const title = $("title").first().text().trim() || new URL(safeUrl).hostname;
    const content = ($("main, article").first().text() || $("body").text()).replace(/\s+/g, " ").trim().slice(0, 120000);
    if (content.length < 50) throw new Error("No readable page content was found.");
    const hostname = new URL(safeUrl).hostname.toLowerCase();
    return {
      id: randomUUID(),
      title,
      url: safeUrl,
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
