import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { databaseUrl } from "../../../scripts/db-config.mjs";
const globalDb = globalThis as unknown as { academyPrisma?: PrismaClient };
export const prisma =
  globalDb.academyPrisma ||
  new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
if (process.env.NODE_ENV !== "production") globalDb.academyPrisma = prisma;
