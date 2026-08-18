// OCR no servidor via API HTTP do Puter (ai-ocr / drivers/call) usando o auth
// token da tua conta. Em serverless (Vercel) o SDK puter.js não funciona
// (vm/WebSocket rebentam), por isso a chamada é replicada com fetch puro,
// exatamente com o mesmo formato que o SDK usa. Devolve "" quando o token não
// está configurado ou a chamada falha.
const PUTER_API = process.env.PUTER_API_ORIGIN || "https://api.puter.com";

export async function puterOcr(imageBase64: string): Promise<string> {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token || token.length < 10) return "";

  try {
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
    const resp = await fetch(`${PUTER_API}/drivers/call`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;actually=json" },
      body: JSON.stringify({
        interface: "puter-ocr",
        driver: "ai-ocr",
        method: "recognize",
        args: { source: dataUrl },
        auth_token: token,
      }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    if (!data || data.success === false) return "";

    const r = data.result ?? data;
    if (Array.isArray(r.blocks) && r.blocks.length) {
      let t = "";
      for (const b of r.blocks) {
        if (
          typeof b?.text === "string" &&
          (!b.type || b.type === "text/textract:LINE" || b.type.startsWith("text/"))
        ) {
          t += `${b.text}\n`;
        }
      }
      if (t.trim()) return t.trim();
    }
    if (Array.isArray(r.pages) && r.pages.length) {
      const t = r.pages
        .map((p: { markdown?: string }) => (p?.markdown || "").trim())
        .filter(Boolean)
        .join("\n\n");
      if (t.trim()) return t.trim();
    }
    if (typeof r.document_annotation === "string") return r.document_annotation.trim();
    if (typeof r.text === "string") return r.text.trim();
    return "";
  } catch (error) {
    console.error("Puter HTTP OCR error:", error);
    return "";
  }
}
