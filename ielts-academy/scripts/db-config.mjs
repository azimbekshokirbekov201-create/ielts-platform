import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const configured = process.env.DATABASE_URL || "file:./db/academy.db";
if (!configured.startsWith("file:"))
  throw new Error("DATABASE_URL must be a local SQLite file: URL.");
export const databaseUrl = pathToFileURL(resolve(configured.slice(5))).href;
