const { init } = require("@heyputer/puter.js/src/init.cjs");

let puterInstance: ReturnType<typeof init> | null = null;

function getPuter() {
  if (!puterInstance) {
    puterInstance = init(process.env.PUTER_AUTH_TOKEN);
  }
  return puterInstance;
}

// OCR no servidor via Puter.js (img2txt) usando o auth token da tua conta.
// Devolve "" quando o token não está configurado ou a chamada falha.
export async function puterOcr(imageBase64: string): Promise<string> {
  const token = process.env.PUTER_AUTH_TOKEN;
  if (!token || token.length < 10) return "";

  try {
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
    const text = await getPuter().ai.img2txt(dataUrl);
    return (text || "").trim();
  } catch (error) {
    console.error("Puter OCR error:", error);
    return "";
  }
}
