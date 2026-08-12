import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { changeWorkspacePassword } from "@/lib/profile-store";
import { updatePasswordSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  try {
    const input = updatePasswordSchema.parse(await request.json());
    await changeWorkspacePassword(input.currentPassword, input.newPassword);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error, "Could not update password.", 400);
  }
}