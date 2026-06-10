import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const databaseEnabled = Boolean(process.env.DATABASE_URL) && process.env.DEMO_MODE !== "true";

export const prisma = databaseEnabled
  ? globalForPrisma.prisma ?? new PrismaClient()
  : null;

export function getPrismaClient() {
  if (!prisma) throw new Error("Database persistence is not configured.");
  return prisma;
}

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}
