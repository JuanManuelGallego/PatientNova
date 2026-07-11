import "dotenv/config";
import type { PrismaConfig } from "prisma";
import { env } from "prisma/config";

export default {
    schema: "./schema.prisma",
    migrations: {
        path: "./migrations",
        seed: "tsx src/prisma/seed-admin.ts",
    },
    datasource: {
        url: env("DATABASE_URL"),
    },
} satisfies PrismaConfig;