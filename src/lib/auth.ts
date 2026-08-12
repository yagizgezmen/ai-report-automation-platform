const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const AUTH_COOKIE_NAME = "arqive_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function createSignature(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(new Uint8Array(signature));
}

export function isAuthConfigured() {
  return Boolean(process.env.AUTH_SECRET?.trim());
}

export async function createSessionToken(username = "admin") {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET is not configured.");
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: username,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadSegment = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await createSignature(payloadSegment, process.env.AUTH_SECRET);
  return `${payloadSegment}.${signature}`;
}

export async function verifySessionToken(token?: string) {
  if (!token || !isAuthConfigured() || !process.env.AUTH_SECRET) return null;
  const [payloadSegment, signature] = token.split(".");
  if (!payloadSegment || !signature) return null;

  const expectedSignature = await createSignature(payloadSegment, process.env.AUTH_SECRET);
  if (signature !== expectedSignature) return null;

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(payloadSegment))) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function getLoginRedirectPath(nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return "/";
  if (nextPath.startsWith("/login")) return "/";
  return nextPath;
}