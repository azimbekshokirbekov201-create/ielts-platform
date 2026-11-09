import { NextResponse } from "next/server";
import { userDb } from "@/server/local/client";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = await userDb();
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "reset"
            ? "/reset-password"
            : "/dashboard",
          process.env.APP_URL || url.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=verification_failed",
      process.env.APP_URL || url.origin,
    ),
  );
}
