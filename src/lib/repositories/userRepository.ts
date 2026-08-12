import { getPrismaClient } from "@/lib/prisma";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "workspace-user";
}

export function usernameToWorkspaceEmail(username: string) {
  return `${normalizeUsername(username)}@workspace.local`;
}

export async function ensureWorkspaceUser(username: string) {
  const email = usernameToWorkspaceEmail(username);
  return getPrismaClient().user.upsert({
    where: { email },
    update: { name: username },
    create: {
      email,
      name: username,
    },
  });
}