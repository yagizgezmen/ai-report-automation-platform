import "server-only";

import { randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface WorkspaceProfile {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  username: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicWorkspaceProfile {
  id: string;
  fullName: string;
  title: string;
  email: string;
  phone: string;
  username: string;
  createdAt: string;
  updatedAt: string;
}

const profileDirectory = path.join(process.cwd(), ".data");
const profilePath = path.join(profileDirectory, "workspace-profile.json");

export function workspaceProfileExists() {
  return existsSync(profilePath);
}

function hashPassword(password: string, salt = randomUUID()) {
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, existingHash] = storedHash.split(":");
  if (!salt || !existingHash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(existingHash, "hex");
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function createDefaultProfile(): WorkspaceProfile {
  const now = new Date().toISOString();
  const username = process.env.AUTH_USERNAME?.trim() || "admin";
  const password = process.env.AUTH_PASSWORD?.trim();
  if (!password) {
    throw new Error("AUTH_PASSWORD is required to create the initial workspace profile.");
  }
  return {
    id: "workspace-owner",
    fullName: "Ayşe Yılmaz",
    title: "Senior Consultant",
    email: "ayse.yilmaz@arqive.ai",
    phone: "+90 555 123 45 67",
    username,
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };
}

async function writeProfile(profile: WorkspaceProfile) {
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(profilePath, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

export function toPublicProfile(profile: WorkspaceProfile): PublicWorkspaceProfile {
  const { passwordHash, ...safeProfile } = profile;
  void passwordHash;
  return safeProfile;
}

export async function getWorkspaceProfile(): Promise<WorkspaceProfile> {
  try {
    const raw = await readFile(profilePath, "utf8");
    return JSON.parse(raw) as WorkspaceProfile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error("Workspace profile could not be loaded. Fix or restore .data/workspace-profile.json.");
    }
    const profile = createDefaultProfile();
    await writeProfile(profile);
    return profile;
  }
}

export async function validateWorkspaceCredentials(username: string, password: string) {
  const profile = await getWorkspaceProfile();
  return profile.username === username && verifyPassword(password, profile.passwordHash) ? profile : null;
}

export async function updateWorkspaceProfile(input: {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  username: string;
}) {
  const current = await getWorkspaceProfile();
  const updated: WorkspaceProfile = {
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  };
  await writeProfile(updated);
  return updated;
}

export async function changeWorkspacePassword(currentPassword: string, newPassword: string) {
  const current = await getWorkspaceProfile();
  if (!verifyPassword(currentPassword, current.passwordHash)) {
    throw new Error("Current password is incorrect.");
  }
  const updated: WorkspaceProfile = {
    ...current,
    passwordHash: hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  await writeProfile(updated);
  return updated;
}