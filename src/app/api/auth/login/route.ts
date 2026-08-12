import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getLoginRedirectPath,
  getSessionCookieOptions,
  isAuthConfigured,
} from "@/lib/auth";
import { validateWorkspaceCredentials } from "@/lib/profile-store";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
    }

    const input = loginSchema.parse(await request.json());
    const profile = await validateWorkspaceCredentials(input.username, input.password);
    if (!profile) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, redirectTo: getLoginRedirectPath(input.next) });
    response.cookies.set(AUTH_COOKIE_NAME, await createSessionToken(profile.username), getSessionCookieOptions());
    return response;
  } catch (error) {
    return apiErrorResponse(error, "Could not sign in.", 400);
  }
}