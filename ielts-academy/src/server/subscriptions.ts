import { createHmac, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { prisma } from "./local/database";
import { Store, ApiError } from "./local/engine";
function digest(code: string) {
  const dir = resolve(process.env.PRIVATE_UPLOAD_DIR || "private-uploads");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, ".promo-key");
  try {
    writeFileSync(path, randomBytes(32), { flag: "wx", mode: 0o600 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  return createHmac("sha256", readFileSync(path))
    .update(code.trim().toUpperCase())
    .digest("hex");
}
export async function grant(
  s: Store,
  uid: string,
  days: number,
  source: string,
) {
  if (!(await s.get("profiles", uid))) throw new ApiError(404, "not_found");
  const current = (await s.all("subscriptions"))
    .filter((x) => x.user_id === uid && !x.revoked_at)
    .reduce((n, x) => Math.max(n, Date.parse(x.expires_at)), Date.now());
  const row = await s.add("subscriptions", {
    user_id: uid,
    activated_at: new Date().toISOString(),
    expires_at: new Date(current + days * 86400000).toISOString(),
    source,
    revoked_at: null,
  });
  await s.audit("grant_premium", "subscriptions", row.id);
  return row;
}
export async function subscriptionRequest(
  req: Request,
  uid: string,
  path: string[],
) {
  const adminStore = new Store(prisma, uid);
  const admin = await adminStore.admin();
  const key = path.join("/");
  if (req.method === "GET" && key === "subscription") {
    const rows = (await adminStore.all("subscriptions")).filter(
      (x) => x.user_id === uid,
    );
    const active = rows
      .filter((x) => !x.revoked_at && Date.parse(x.expires_at) > Date.now())
      .sort((a, b) => b.expires_at.localeCompare(a.expires_at));
    return {
      tier: active.length ? "premium" : "free",
      activated_at: active[0]?.activated_at || null,
      expires_at: active[0]?.expires_at || null,
      remaining_days: active.length
        ? Math.ceil((Date.parse(active[0].expires_at) - Date.now()) / 86400000)
        : 0,
      grants: rows,
    };
  }
  if (key === "subscription/redeem" && req.method !== "POST")
    throw new ApiError(405, "method_not_allowed");
  if (key !== "subscription/redeem" && !admin)
    throw new ApiError(403, "forbidden");
  if (req.method === "GET") {
    return {
      codes: (await adminStore.all("promo_codes")).map(({ lookup, ...row }) => {
        void lookup;
        return row;
      }),
      subscriptions: await adminStore.all("subscriptions"),
      redemptions: await adminStore.all("promo_redemptions"),
    };
  }
  const body = await req.text();
  if (body.length > 10000) throw new ApiError(413, "too_large");
  const p = JSON.parse(body);
  if (key === "subscription/redeem") {
    const allowed = await prisma.$transaction((tx) =>
      new Store(tx, uid, true).rpc("consume_rate_limit", {
        k: "promo:" + uid,
        max_hits: 5,
        window_seconds: 60,
      }),
    );
    if (!allowed) throw new ApiError(429, "rate_limited");
  }
  for (let attempt = 0; ; attempt++)
    try {
      return await prisma.$transaction(
        async (tx) => {
          // First statement takes SQLite's write lock before checking quotas or stacking grants.
          await tx.rateLimit.upsert({
            where: { key: "subscription-lock" },
            create: { key: "subscription-lock", start: new Date(), hits: 1 },
            update: { hits: { increment: 1 } },
          });
          const s = new Store(tx, uid);
          const now = new Date().toISOString();
          if (key === "subscription/redeem") {
            const { code } = z
              .object({
                code: z
                  .string()
                  .trim()
                  .min(8)
                  .max(64)
                  .regex(/^[a-zA-Z0-9-]+$/),
              })
              .parse(p);
            const lookup = digest(code);
            const c = (await s.all("promo_codes")).find(
              (x) => x.lookup === lookup,
            );
            if (
              !c ||
              !c.enabled ||
              c.revoked_at ||
              (c.expires_at && c.expires_at <= now) ||
              c.used >= c.limit ||
              (await s.get("promo_redemptions", uid + ":" + c.id))
            )
              throw new ApiError(409, "promo_unavailable");
            const sub = await grant(s, uid, c.days, "promo:" + c.id);
            await s.put("promo_redemptions", {
              id: uid + ":" + c.id,
              user_id: uid,
              code_id: c.id,
              subscription_id: sub.id,
              redeemed_at: now,
            });
            await s.put("promo_codes", { ...c, used: c.used + 1 });
            return sub;
          }
          if (key === "admin/subscriptions/codes") {
            const input = z
              .object({
                code: z
                  .string()
                  .trim()
                  .min(8)
                  .max(64)
                  .regex(/^[a-zA-Z0-9-]+$/)
                  .optional(),
                label: z.string().max(100).default("Premium access"),
                days: z.number().int().min(1).max(3650),
                limit: z.number().int().min(1).max(100000),
                expires_at: z.iso.datetime().nullable().optional(),
              })
              .parse(p);
            const code = (
              input.code || randomBytes(16).toString("hex")
            ).toUpperCase();
            const lookup = digest(code);
            if ((await s.all("promo_codes")).some((x) => x.lookup === lookup))
              throw new ApiError(409, "operation_rejected");
            const row = await s.add("promo_codes", {
              label: input.label,
              days: input.days,
              limit: input.limit,
              expires_at: input.expires_at || null,
              lookup,
              used: 0,
              enabled: true,
              revoked_at: null,
            });
            await s.audit("create_promo", "promo_codes", row.id);
            return { id: row.id, code };
          }
          if (key === "admin/subscriptions/grant") {
            const input = z
              .object({
                user_id: z.uuid(),
                days: z.number().int().min(1).max(3650),
              })
              .parse(p);
            return grant(s, input.user_id, input.days, "manual:" + uid);
          }
          if (key === "admin/subscriptions/revoke") {
            const { id } = z.object({ id: z.uuid() }).parse(p);
            const row = await s.get("subscriptions", id);
            if (!row) throw new ApiError(404, "not_found");
            await s.put("subscriptions", { ...row, revoked_at: now });
            await s.audit("revoke_premium", "subscriptions", id);
            return true;
          }
          if (key === "admin/subscriptions/code") {
            const input = z
              .object({
                id: z.uuid(),
                enabled: z.boolean().optional(),
                revoke: z.boolean().optional(),
              })
              .parse(p);
            const c = await s.get("promo_codes", input.id);
            if (!c) throw new ApiError(404, "not_found");
            await s.put("promo_codes", {
              ...c,
              enabled: input.enabled ?? c.enabled,
              revoked_at: input.revoke ? now : c.revoked_at,
            });
            await s.audit("update_promo", "promo_codes", c.id);
            return true;
          }
          throw new ApiError(404, "not_found");
        },
        { timeout: 15000 },
      );
    } catch (error) {
      if (attempt >= 4 || !/locked|busy|P2034|SQLITE_BUSY/i.test(String(error)))
        throw error;
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
}
export interface PaymentProvider {
  name: "click" | "payme";
  verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<{
    verified: true;
    providerTransactionId: string;
    orderId: string;
  }>;
}
// Provider implementations must verify signatures and settle an immutable server-priced order
// idempotently before calling grant(). No payment provider is configured or paid status synthesized.
export type PaymentOrder = {
  id: string;
  user_id: string;
  amount: number;
  currency: "UZS";
  days: number;
  status: "pending" | "paid" | "failed";
};
