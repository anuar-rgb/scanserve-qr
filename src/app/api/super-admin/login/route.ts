import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { signSuperAdminSession } from "@/lib/session";
import { log } from "@/lib/log";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(`super:${ip}`, 3, 30 * 60 * 1000)) {
    log.warn("super_admin:login:rate_limit", { ip });
    return NextResponse.json({ error: "Слишком много попыток. Подождите 30 минут." }, { status: 429 });
  }

  const { username, password } = await request.json();

  if (username && !checkRateLimit(`super:user:${username}`, 5, 30 * 60 * 1000)) {
    log.warn("super_admin:login:rate_limit", { ip, username });
    return NextResponse.json({ error: "Слишком много попыток. Подождите 30 минут." }, { status: 429 });
  }

  const validUser = process.env.SUPER_ADMIN_USERNAME;
  const validPass = process.env.SUPER_ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    log.error("super_admin:login:config_missing");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  if (username !== validUser || password !== validPass) {
    log.warn("super_admin:login:failed", { ip, username });
    return NextResponse.json({ error: "Неверный логин или пароль." }, { status: 401 });
  }

  log.info("super_admin:login:success", { ip });
  const response = NextResponse.json({ ok: true });
  response.cookies.set("super_admin_session", signSuperAdminSession(), {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours — super-admin has full platform access
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
