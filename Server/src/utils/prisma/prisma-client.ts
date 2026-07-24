import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../../generated/prisma/client.js"; // adjust path to your output
import { logger } from "../api/logger.js";
import { encryptionExtension } from "./encryption-extension.js";
import { config } from "../config/config.js";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: ReturnType<typeof createPrismaClient> | undefined;
  var __prismaDisconnected: boolean | undefined;
}

function createPrismaClient() {
  const adapter = new PrismaPg({
      connectionString: config.databaseUrl,
      connectionTimeoutMillis: config.database.connectionTimeout,
      max: config.database.poolSize,
      min: config.database.poolMin,
      idleTimeoutMillis: config.database.idleTimeout,
    });


  const baseClient = new PrismaClient({
    adapter,
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });

  baseClient.$on("error", (e) => {
    logger.error({ message: e.message, target: e.target }, "Prisma error event");
  });

  baseClient.$on("warn", (e) => {
    logger.warn({ message: e.message, target: e.target }, "Prisma warn event");
  });

  return baseClient.$extends(encryptionExtension);
}

export const prisma = global.__prisma ?? createPrismaClient();

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

process.on("beforeExit", async () => {
  if (!global.__prismaDisconnected) {
    global.__prismaDisconnected = true;
    await prisma.$disconnect();
    logger.info("Prisma disconnected");
  }
});
