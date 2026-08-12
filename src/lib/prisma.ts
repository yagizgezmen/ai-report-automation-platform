import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  persistenceModeLogged?: boolean;
  persistenceWarningLogged?: boolean;
  persistenceErrorLogged?: boolean;
};

const demoModeRequested = process.env.DEMO_MODE === "true";
const databaseUrlConfigured = Boolean(process.env.DATABASE_URL?.trim());

export const persistenceMode = demoModeRequested
  ? "DEMO"
  : databaseUrlConfigured
    ? "POSTGRESQL"
    : "UNCONFIGURED";

export const databaseEnabled = persistenceMode === "POSTGRESQL";

export const prisma = databaseEnabled
  ? globalForPrisma.prisma ?? new PrismaClient()
  : null;

export function persistenceModeLabel() {
  if (persistenceMode === "POSTGRESQL") return "PostgreSQL";
  if (persistenceMode === "DEMO") return "DEMO / IN-MEMORY";
  return "UNCONFIGURED";
}

function persistenceConfigurationError() {
  return new Error("Persistence is not configured. Set DATABASE_URL for PostgreSQL mode or DEMO_MODE=true for demo mode.");
}

export function getPrismaClient() {
  if (!prisma) throw persistenceConfigurationError();
  return prisma;
}

if (process.env.NODE_ENV !== "production" && prisma) {
  globalForPrisma.prisma = prisma;
}

if (!globalForPrisma.persistenceModeLogged) {
  globalForPrisma.persistenceModeLogged = true;
  console.info(`[PERSISTENCE] Mode: ${persistenceModeLabel()}`);
}

if (demoModeRequested && databaseUrlConfigured && !globalForPrisma.persistenceWarningLogged) {
  globalForPrisma.persistenceWarningLogged = true;
  console.warn("[PERSISTENCE WARNING]\nDATABASE_URL is configured but DEMO_MODE=true.\nData will NOT be persisted to PostgreSQL.");
}

if (persistenceMode === "UNCONFIGURED" && !globalForPrisma.persistenceErrorLogged) {
  globalForPrisma.persistenceErrorLogged = true;
  console.error("[PERSISTENCE ERROR] DATABASE_URL is not configured and DEMO_MODE is not true. Configure PostgreSQL or explicitly enable demo mode.");
}

if (prisma) {
  prisma.$connect().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[PERSISTENCE ERROR] PostgreSQL persistence is configured but the database could not be reached.");
    console.error(message);
  });
}
