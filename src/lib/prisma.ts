import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  persistenceModeLogged?: boolean;
};

export const databaseEnabled = Boolean(process.env.DATABASE_URL) && process.env.DEMO_MODE !== "true";
export const persistenceMode = databaseEnabled ? "DATABASE_MODE" : "DEMO_MODE";

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

if (!globalForPrisma.persistenceModeLogged) {
  globalForPrisma.persistenceModeLogged = true;
  const databaseUrlState = process.env.DATABASE_URL ? "present" : "missing";
  console.info(`[persistence] mode=${persistenceMode} DEMO_MODE=${process.env.DEMO_MODE ?? "undefined"} DATABASE_URL=${databaseUrlState}`);
}
