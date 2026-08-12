import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { getWorkspaceProfile, toPublicProfile, updateWorkspaceProfile } from "@/lib/profile-store";
import { updateProfileSchema } from "@/lib/validation";

export async function GET() {
  try {
    const profile = await getWorkspaceProfile();
    return NextResponse.json(toPublicProfile(profile));
  } catch (error) {
    return apiErrorResponse(error, "Could not load profile.");
  }
}

export async function PATCH(request: Request) {
  try {
    const input = updateProfileSchema.parse(await request.json());
    const updated = await updateWorkspaceProfile(input);
    return NextResponse.json(toPublicProfile(updated));
  } catch (error) {
    return apiErrorResponse(error, "Could not update profile.", 400);
  }
}