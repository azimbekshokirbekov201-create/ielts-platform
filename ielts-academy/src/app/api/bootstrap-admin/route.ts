import { userDb } from "@/server/local/client";
import { prisma } from "@/server/local/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return new Response(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin setup</title></head><body style="font:16px system-ui;max-width:520px;margin:70px auto;padding:20px"><h2>IELTS Platform — birinchi Admin</h2><p>Avval platformadagi akkauntingizga kiring. Keyin quyidagi tugmani bosing.</p><button id="go" style="padding:12px 20px;cursor:pointer">Admin huquqini faollashtirish</button><p id="status"></p><script>document.getElementById('go').onclick=async()=>{const s=document.getElementById('status');s.textContent='Tekshirilmoqda...';try{const r=await fetch('/api/bootstrap-admin',{method:'POST',headers:{'Content-Type':'application/json'}});const x=await r.json();s.textContent=x.message||'Xatolik';if(r.ok)s.textContent+=' Endi tizimdan chiqib, qayta kiring.'}catch{s.textContent='Ulanishda xatolik'}}</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'" },
  });
}

export async function POST(request: Request) {
  const expectedOrigin = new URL(process.env.APP_URL || request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin)
    return Response.json({ message: "Forbidden" }, { status: 403 });
  const target = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!target) return Response.json({ message: "Admin setup disabled" }, { status: 503 });
  const { data: { user }, error } = await (await userDb()).auth.getUser();
  if (error || !user || user.email?.trim().toLowerCase() !== target)
    return Response.json({ message: "Please sign in using the designated admin account" }, { status: 403 });
  try {
    const status = await prisma.$transaction(async (tx) => {
      const existing = await tx.entity.findMany({ where: { kind: "user_roles" } });
      const admins = existing.filter((entry) => (entry.data as { role?: string }).role === "ADMIN");
      if (admins.length) {
        if (admins.some((entry) => (entry.data as { user_id?: string }).user_id === user.id)) return "already_admin";
        return "another_admin_exists";
      }
      const account = await tx.account.findUnique({ where: { id: user.id } });
      if (!account || account.email.toLowerCase() !== target) return "account_missing";
      const id = account.id + ":ADMIN";
      await tx.entity.create({ data: { id, kind: "user_roles", data: { id, user_id: account.id, role: "ADMIN" } } });
      return "admin_created";
    });
    const responses: Record<string, [number, string]> = {
      admin_created: [200, "Admin huquqi berildi."],
      already_admin: [200, "Bu akkaunt allaqachon Admin."],
      another_admin_exists: [409, "Birinchi Admin mavjud. Boshqa rollarni Admin paneldan boshqaring."],
      account_missing: [404, "Akkaunt topilmadi. Qayta ro'yxatdan o'ting."],
    };
    const [statusCode, message] = responses[status] || [500, "Unknown error"];
    return Response.json({ message }, { status: statusCode });
  } catch {
    return Response.json({ message: "Admin tayinlashda server xatosi" }, { status: 500 });
  }
}
