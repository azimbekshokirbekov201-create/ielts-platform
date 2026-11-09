import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { databaseUrl } from "./db-config.mjs";
const email = (process.argv[2] || process.env.ADMIN_EMAIL || "")
  .trim()
  .toLowerCase();
if (!email)
  throw new Error(
    "Provide the email of an existing registered account: npm run db:admin -- email@example.com",
  );
const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: databaseUrl }),
});
try {
  await db.$transaction(async (tx) => {
    const roles = await tx.entity.findMany({ where: { kind: "user_roles" } });
    if (roles.some((x) => x.data.role === "ADMIN"))
      throw new Error(
        "An administrator already exists. Use the Admin UI to grant more roles.",
      );
    const account = await tx.account.findUnique({ where: { email } });
    if (!account)
      throw new Error("Register this account in the application first.");
    const id = account.id + ":ADMIN";
    await tx.entity.create({
      data: {
        kind: "user_roles",
        id,
        data: { id, user_id: account.id, role: "ADMIN" },
      },
    });
  });
  console.log("First administrator provisioned. Sign in normally.");
} finally {
  await db.$disconnect();
}
