import "server-only";

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function getSessionUsername() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  return session?.sub || null;
}

export async function requireSessionUsername() {
  const username = await getSessionUsername();
  if (!username) throw new Error("Authentication required.");
  return username;
}