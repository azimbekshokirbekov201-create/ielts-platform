import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { DatabaseSync, backup } from "node:sqlite";
import { databaseUrl } from "./db-config.mjs";
const path = fileURLToPath(databaseUrl);
mkdirSync(dirname(path), { recursive: true });
const existed = existsSync(path);
const db = new DatabaseSync(path);
if (existed) {
  const destination = path + ".backup-" + Date.now() + ".db";
  await backup(db, destination);
  console.log("Database backup: " + destination);
}
db.exec(
  "PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;",
);
db.exec(
  "CREATE TABLE IF NOT EXISTS _academy_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)",
);
try {
  for (const entry of readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((x) => x.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const sql = readFileSync(
      join("prisma/migrations", entry.name, "migration.sql"),
      "utf8",
    );
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = db
      .prepare("SELECT checksum FROM _academy_migrations WHERE name=?")
      .get(entry.name);
    if (previous) {
      if (previous.checksum !== checksum)
        throw new Error("Applied migration changed: " + entry.name);
      continue;
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO _academy_migrations VALUES (?,?,?)").run(
        entry.name,
        checksum,
        new Date().toISOString(),
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  const put = db.prepare(
    "INSERT OR IGNORE INTO Entity(kind,id,data) VALUES(?,?,?)",
  );
  put.run(
    "platform_settings",
    "true",
    JSON.stringify({
      id: true,
      ai_enabled: false,
      ai_daily_user_limit: 5,
      ai_daily_platform_limit: 100,
    }),
  );
  put.run(
    "achievements",
    "onboarding_complete",
    JSON.stringify({
      id: "onboarding_complete",
      code: "onboarding_complete",
      title: "Onboarding complete",
    }),
  );
  console.log(
    "SQLite initialized at " +
      path +
      ". No sample users or results were created.",
  );
} finally {
  db.close();
}
