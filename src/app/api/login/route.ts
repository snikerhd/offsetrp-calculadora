import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_S, createSessionToken, verifyCredentials } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user, password } = body as { user?: string; password?: string };
    if (!password || typeof password !== "string" || !verifyCredentials(user, password)) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    // Em localhost (http) a flag Secure impediria o browser de devolver o
    // cookie de sessão. Nos deploys reais (https) mantém-se Secure.
    const host = (req.headers.get("host") || "").toLowerCase();
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    res.cookies.set(SESSION_COOKIE, createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocal,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_S,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Erro no login." }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
