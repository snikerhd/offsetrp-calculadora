// Motor de OCR via Google Lens, usando a mesma API que o browser Chromium usa
// (pacote chrome-lens-ocr). Grátis, sem chave, sem conta, sem headless browser.
// Verificado: 2.8s e texto completo (com pesos) na imagem de referência.
import Lens from "chrome-lens-ocr";

export let lastLensError = "";

const lensSingleton = new Lens();

export async function lensOcr(base64Data: string, timeoutMs = 15_000): Promise<string> {
  lastLensError = "";
  const timeout = new Promise<null>((res) => setTimeout(() => res(null), timeoutMs));
  try {
    const result = await Promise.race([lensSingleton.scanByBuffer(Buffer.from(base64Data, "base64")), timeout]);
    if (!result) {
      lastLensError = "timeout";
      return "";
    }
    // O inventário do jogo é uma grelha de 5 colunas; cada slot tem o badge
    // "N (peso)" em cima e o NOME em baixo. Reconstruímos esse emparelhamento
    // a partir das bounding boxes e emitimos linhas "N (peso) NOME" — formato
    // de emparelhamento direto qty↔nome que o parser aceita como fiável.
    const segs = result.segments as Array<{ text: string; boundingBox: { centerPerX: number; centerPerY: number } }>;
    const colOf = (x: number) => (x < 0.2 ? 0 : x < 0.4 ? 1 : x < 0.6 ? 2 : x < 0.8 ? 3 : 4);
    // Detecta ambos os formatos de badge de quantidade:
//   - Formato antigo: "64 (1.0)"  →  qty badge com peso
//   - Formato novo:   "(x64)"     →  qty badge sem peso (xN)
const isQtyBadge = (t: string) => /^\d{1,7}\s*\(/.test(t.trim()) || /^\(x\d{1,7}\)$/i.test(t.trim());
    const isNoise = (t: string) => /^\d{1,2}:\d{2}$/.test(t.trim()) || t.trim() === "+";
    // Agrupar por coluna → linhas (y), juntando segmentos da mesma linha.
    const columns: Array<Array<{ y: number; x: number; text: string }>> = [[], [], [], [], []];
    for (const s of segs) {
      if (isNoise(s.text)) continue;
      columns[colOf(s.boundingBox.centerPerX)].push({ y: s.boundingBox.centerPerY, x: s.boundingBox.centerPerX, text: s.text.trim() });
    }
    const lines: string[] = [];
    for (const col of columns) {
      col.sort((a, b) => a.y - b.y || a.x - b.x);
      // fundir segmentos da mesma linha (nomes partidos: "CARREGADOR DE"+"SMG")
      const rows: Array<{ y: number; text: string; qty: boolean }> = [];
      for (const s of col) {
        const prev = rows[rows.length - 1];
        if (prev && Math.abs(s.y - prev.y) < 0.06) {
          prev.text += (prev.qty === isQtyBadge(s.text) && !prev.qty ? " " : "\t") + s.text;
          prev.qty = prev.qty && isQtyBadge(s.text);
        } else {
          rows.push({ y: s.y, text: s.text, qty: isQtyBadge(s.text) });
        }
      }
      let pendingQty: string | null = null;
      for (const r of rows) {
        const clean = r.text.replace(/\s+/g, " ").trim();
        if (!clean) continue;
        if (r.qty) {
          pendingQty = clean;
        } else {
          lines.push(pendingQty ? `${pendingQty} ${clean}` : clean);
          pendingQty = null;
        }
      }
    }
    const text = lines.join("\n").trim();
    // Fallback: se a reconstrução da grelha falhar (poucas linhas), devolve
    // o texto bruto dos segmentos — o parser já lê "• Name (xN)" e "N Name".
    const fallback = segs.map((s) => s.text.trim()).filter(Boolean).join("\n");
    return text.length > 0 && lines.length >= 2 ? text : fallback;
  } catch (e) {
    lastLensError = e instanceof Error ? e.message : String(e);
    return "";
  }
}
