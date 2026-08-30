import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Código OAuth em falta." }, { status: 400 });
  }

  const clientId = process.env.GYAZO_CLIENT_ID;
  const clientSecret = process.env.GYAZO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GYAZO_CLIENT_ID ou GYAZO_CLIENT_SECRET não configurados." }, { status: 500 });
  }

  try {
    const resp = await fetch("https://api.gyazo.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: "http://localhost:3000/callback",
      }),
    });

    const data = await resp.json();
    const token = data.access_token;

    if (!token) {
      return new NextResponse(
        `<html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
          <h2 style="color:#f87171">❌ Erro ao obter token</h2>
          <pre style="background:#1e293b;padding:1rem;border-radius:8px">${JSON.stringify(data, null, 2)}</pre>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:2rem;background:#0f172a;color:#f1f5f9">
        <h2 style="color:#4ade80">✅ Token obtido com sucesso!</h2>
        <p>Copia este token e cola no <code>.env.local</code> em <code>GYAZO_ACCESS_TOKEN=</code></p>
        <div style="background:#1e293b;padding:1rem;border-radius:8px;word-break:break-all;font-size:1.1rem;color:#818cf8;font-weight:bold">
          ${token}
        </div>
        <p style="margin-top:1rem;color:#94a3b8">Depois de colares o token, reinicia o servidor (<code>npm run dev</code>) e o OCR do Gyazo ficará ativo.</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
