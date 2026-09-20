"use client";

import { useState, useRef, useCallback } from "react";
import { BarChart3, Camera } from "lucide-react";
import { ITEM_BY_NAME } from "@/lib/item-weights";
import { CRIMES_CATALOGO } from "@/lib/data";

// Coima base de "Posse de Munição" (crimes graves): 10.000 € + 6 meses.
// Aplicada apenas no modo Coimas Rápidas — nunca no OCR dos Relatórios.
const CRIME_POSSE_MUNICAO = CRIMES_CATALOGO.find((c) => c.nome === "Posse de Munição");

interface OcrBlockProps {
  inputCls: string;
  fillBtnTheme: string;
  neonShadow: string;
  accentColor: string;
  onResult: (txt: string) => void;
  // "coimas": inclui a arma inspecionada + todo o inventário no resultado.
  // "relatorio" (default): comportamento original (só balas/acessórios do popup).
  mode?: "coimas" | "relatorio";
}

interface DetectedWeight {
  item: string;
  qty: number;
  kg: number;
  unitKg: number | null;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  matchReason: string;
}

export default function OcrBlock({ inputCls, fillBtnTheme, neonShadow, accentColor, onResult, mode = "relatorio" }: OcrBlockProps) {
  const [ocrUrl, setOcrUrl] = useState("");
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrWeights, setOcrWeights] = useState<DetectedWeight[]>([]);
  const [ocrOverallConfidence, setOcrOverallConfidence] = useState<number | null>(null);
  const [ocrWeapon, setOcrWeapon] = useState<{ weaponItem: string; ammo: number; ammoItem: string; accessoryCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ocrTotalQty = ocrWeights.reduce((sum, w) => sum + w.qty, 0);
  const ocrTotalKg = ocrWeights.reduce((sum, w) => sum + (w.kg > 0 ? w.kg : 0), 0);

  // OCR no navegador via Puter.js (user-pays: usa o saldo grátis do visitante,
  // sem chave para o dono do site). Só faz sentido para URLs públicas; ficheiros
  // locais são convertidos para data URL antes de chamar.
  const runServerOcr = useCallback(async (payload: { imageUrl?: string; imageBase64?: string; mimeType?: string; rawText?: string }) => {
    let resp: Response;
    try {
      resp = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, mode }),
      });
    } catch {
      throw new Error("Não foi possível contactar o servidor de OCR. Verifica a ligação à internet.");
    }

    // O servidor pode devolver uma página HTML de erro (timeout da plataforma
    // free, ex.: Vercel/Netlify) em vez de JSON. Lê-se como texto primeiro para
    // nunca rebentar com "JSON.parse: unexpected character..." e mostrar uma
    // mensagem legível com dica de retry.
    const text = await resp.text();
    let data: {
      result?: string;
      preview?: string;
      error?: string;
      ocrRaw?: string;
      detectedWeights?: DetectedWeight[];
      overallConfidence?: number;
      weaponCapture?: { weaponItem: string; ammo: number; ammoItem: string; accessoryCount: number } | null;
    };
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `O servidor devolveu uma resposta inválida${resp.status ? ` (HTTP ${resp.status})` : ""}. ` +
        "O OCR pode ter excedido o limite do plano gratuito — espera uns segundos e tenta novamente."
      );
    }
    if (!resp.ok) throw new Error(data.error || `Erro do servidor (HTTP ${resp.status}).`);
    return data;
  }, [mode]);

  // Pré-processa a imagem no browser antes do OCR: amplia ×2, converte para
  // escala de cinzentos e inverte se o fundo for escuro (screenshots do jogo
  // têm texto claro sobre fundo escuro — sem isto o Tesseract devolve lixo).
  const preprocessForOcr = useCallback(async (src: string): Promise<string> => {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("load"));
        im.src = src;
      });
      const scale = Math.min(2, 2400 / Math.max(img.width || 1, img.height || 1)) || 1;
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      const ctx = cv.getContext("2d");
      if (!ctx) return src;
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      const d = ctx.getImageData(0, 0, cv.width, cv.height);
      let sum = 0;
      const gray = new Uint8ClampedArray(d.data.length / 4);
      for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
        const g = Math.round(0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]);
        gray[j] = g;
        sum += g;
      }
      const invert = sum / gray.length < 128;
      for (let j = 0, i = 0; j < gray.length; j++, i += 4) {
        const v = invert ? 255 - gray[j] : gray[j];
        d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v; d.data[i + 3] = 255;
      }
      ctx.putImageData(d, 0, 0);
      return cv.toDataURL("image/png");
    } catch {
      return src;
    }
  }, []);

  // Texto "lixo": demasiados símbolos/números sem palavras utilizáveis —
  // resultado típico de OCR sem pré-processamento; melhor ignorar e cair
  // para o passo seguinte da cadeia.
  const looksLikeGarbage = useCallback((text: string): boolean => {
    const t = text.replace(/\s+/g, "");
    if (t.length < 3) return true;
    const alnum = (t.match(/[a-zA-ZÀ-ÿ0-9]/g) || []).length;
    return alnum / t.length < 0.6;
  }, []);

  // OCR client-side via Tesseract.js (CDN, sem chaves/contas/limites — o mesmo
  // motor que o servidor usa, mas no browser). Carrega o script à primeira e
  // devolve "" em caso de falha (o chamador cai para o Puter/servidor).
  const tesseractClientOcr = useCallback(async (src: string): Promise<string> => {
    const w = window as unknown as { Tesseract?: { recognize: (img: string, lang: string) => Promise<{ data?: { text?: string } }> } };
    if (!w.Tesseract) {
      await new Promise<void>((resolve) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
        s.onload = () => resolve();
        s.onerror = () => resolve();
        document.head.appendChild(s);
        // Timeout de segurança: se o CDN estiver bloqueado, não fica pendente.
        setTimeout(resolve, 15_000);
      });
    }
    if (!w.Tesseract) return "";
    try {
      const out = await w.Tesseract.recognize(src, "por");
      return out?.data?.text?.trim() || "";
    } catch (err) {
      console.warn("Tesseract client OCR falhou:", err);
      return "";
    }
  }, []);

  // OCR client-side via puter.js (https://developer.puter.com/tutorials/free-unlimited-ocr-api/):
  // keyless e grátis (modelo user-pays — usa o saldo do visitante). Espera até
  // ~5s pelo script async do layout; devolve "" se indisponível ou falhar, e o
  // chamador cai para a cadeia do servidor (Puter HTTP → Tesseract → Gyazo →
  // OpenAI). Primeira tentativa = motor primário de facto.
  const puterClientOcr = useCallback(async (src: string): Promise<{ text: string; reason: string }> => {
    const w = window as unknown as { puter?: { ai?: { img2txt?: (s: string) => Promise<unknown> } } };
    for (let i = 0; i < 20 && !w.puter?.ai?.img2txt; i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    const fn = w.puter?.ai?.img2txt;
    if (!fn) return { text: "", reason: "puter.js não carregou (bloqueado por adblock/extensão ou rede?)" };
    try {
      const out = await fn(src);
      const text = typeof out === "string" ? out.trim() : "";
      if (!text) return { text: "", reason: "resposta vazia do Puter" };
      return { text, reason: "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn("Puter client OCR falhou:", err);
      return { text: "", reason: msg };
    }
  }, []);

  // Alguns hosts (ex.: Imgur no UK) devolvem uma página de erro "Content not
  // viewable in your region" em vez da imagem. O OCR "extrai" esse HTML como
  // texto e pareceria um resultado válido. Deteta essas mensagens e trata-as
  // como falha, para cair nos motores seguintes (servidor/Tesseract).
  const looksLikeHostError = useCallback((t: string): boolean =>
    /not\s+viewable|not\s+available\s+in\s+your\s+region|content\s+unavailable|region\s+(?:lock|block)|removed\s+from\s+imgur|40[34]\s+(?:not\s+)?found|forbidden|access\s+denied/i.test(t),
  []);

  const handleResult = useCallback((data: {
    result?: string;
    preview?: string;
    error?: string;
    ocrRaw?: string;
    detectedWeights?: DetectedWeight[];
    overallConfidence?: number;
    weaponCapture?: { weaponItem: string; ammo: number; ammoItem: string; accessoryCount: number } | null;
  }) => {
    if (data.preview) setOcrPreview(data.preview);
    if (data.ocrRaw) setOcrRawText(data.ocrRaw);
    setOcrWeights(data.detectedWeights || []);
    setOcrOverallConfidence(data.overallConfidence ?? null);
    setOcrWeapon(data.weaponCapture || null);

    if (data.error && !data.result && !data.weaponCapture) {
      setOcrStatus(`❌ ${data.error}`);
      setOcrProcessing(false);
      return;
    }

    if (data.weaponCapture && !data.result) {
      setOcrStatus(
        `✅ Arma identificada: ${data.weaponCapture.weaponItem.replace(/^arma\s+/i, "")} · Munição: ${data.weaponCapture.ammo} · Acessórios: ${data.weaponCapture.accessoryCount}`
      );
      setOcrProcessing(false);
      return;
    }

    if (data.result) {
      const cleaned = data.result
        .replace(/```[a-z]*\n?/g, "").replace(/\n/g, ", ")
        .replace(/,\s*,/g, ",").replace(/^[\s,]+|[\s,]+$/g, "").trim();

      if (cleaned.length > 0) {
        onResult(cleaned);
        setOcrStatus(data.error ? `⚠️ ${data.error}` : "✅ Itens detetados! Verifica o campo abaixo e clica Calcular.");
      } else {
        setOcrStatus("⚠️ Nenhum item identificado nesta imagem.");
      }
    }
    setOcrProcessing(false);
  }, [onResult]);

  const handleOcrUrl = useCallback(async () => {
    if (!ocrUrl.trim()) return;
    setOcrProcessing(true);
    setOcrPreview(null);
    setOcrRawText("");
    setOcrWeights([]);
    setOcrWeapon(null);
    setOcrStatus("🔍 A analisar imagem com OCR...");

    try {
      // 1ª tentativa: Puter no browser (keyless). Se não devolver texto útil,
      // cai para a cadeia completa do servidor.
      let data;
      // 1ª: Puter no browser (popup de login na 1ª utilização; free unlimited
      // para o dono do site). 2ª: Tesseract no browser com pré-processamento.
      // 3ª: cadeia do servidor.
      let clientText = (await puterClientOcr(ocrUrl.trim())).text;
      if (!clientText || looksLikeHostError(clientText) || looksLikeGarbage(clientText)) {
        clientText = await tesseractClientOcr(await preprocessForOcr(ocrUrl.trim()));
      }
      if (clientText.length >= 3 && !looksLikeHostError(clientText) && !looksLikeGarbage(clientText)) {
        setOcrRawText(clientText);
        data = await runServerOcr({ rawText: clientText });
      } else {
        setOcrStatus("🔍 OCR no browser falhou — a tentar no servidor...");
        data = await runServerOcr({ imageUrl: ocrUrl.trim() });
      }
      if (!data.result && !data.weaponCapture && data.error) throw new Error(data.error);
      handleResult(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      setOcrStatus(`❌ ${msg}`);
      setOcrProcessing(false);
    }
  }, [ocrUrl, handleResult, runServerOcr, puterClientOcr, tesseractClientOcr, preprocessForOcr, looksLikeGarbage]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setOcrProcessing(true);
      setOcrPreview(null);
      setOcrRawText("");
      setOcrWeights([]);
      setOcrStatus("🔍 A analisar imagem com OCR...");

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        setOcrPreview(dataUrl);
        const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
        if (!match) { setOcrStatus("❌ Formato inválido."); setOcrProcessing(false); return; }

        try {
          // 1ª tentativa: Puter no browser (keyless) sobre o data URL local.
          let data;
          // Mesma ordem: Puter client (popup na 1ª utilização) → Tesseract
          // client (com pré-processamento) → servidor.
          let clientText = (await puterClientOcr(dataUrl)).text;
          if (!clientText || looksLikeHostError(clientText) || looksLikeGarbage(clientText)) {
            clientText = await tesseractClientOcr(await preprocessForOcr(dataUrl));
          }
          if (clientText.length >= 3 && !looksLikeHostError(clientText) && !looksLikeGarbage(clientText)) {
            setOcrRawText(clientText);
            data = await runServerOcr({ rawText: clientText });
          } else {
            setOcrStatus("🔍 OCR no browser falhou — a tentar no servidor...");
            data = await runServerOcr({ imageBase64: match[2], mimeType: match[1] });
          }
          if (!data.result && !data.weaponCapture && data.error) throw new Error(data.error);
          handleResult(data);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erro desconhecido";
          setOcrStatus(`❌ ${msg}`);
          setOcrProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [handleResult, runServerOcr, puterClientOcr, tesseractClientOcr, preprocessForOcr, looksLikeGarbage]
  );

  return (
    <div className={`bg-slate-900/60 backdrop-blur-md rounded-xl p-5 border border-white/5 ${neonShadow}`}>
      <h2 className="text-sm uppercase font-extrabold tracking-wider text-gray-300 mb-3 flex items-center gap-2">
        <Camera className={`w-5 h-5 ${accentColor}`} /> Análise de Foto
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Cola um link do Gyazo ou faz upload de screenshot do inventário — o sistema extrai automaticamente os itens e quantidades.
      </p>

      <div className="grid gap-3 md:grid-cols-2 mb-3">
        {/* URL Input */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">🔗 Link da imagem (Gyazo, Imgur…)</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={ocrUrl}
              onChange={(e) => setOcrUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleOcrUrl()}
              placeholder="https://gyazo.com/..."
              className={inputCls}
              disabled={ocrProcessing}
            />
            <button onClick={handleOcrUrl} disabled={ocrProcessing || !ocrUrl.trim()} className={`px-4 py-2 rounded text-xs font-bold uppercase ${fillBtnTheme} cursor-pointer disabled:opacity-50`}>
              {ocrProcessing ? "..." : "Analisar"}
            </button>
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-gray-500">📁 Ou faz upload de imagem</label>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" disabled={ocrProcessing} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={ocrProcessing}
            className="w-full rounded border-2 border-dashed border-white/10 bg-black/20 px-4 py-2.5 text-xs text-gray-400 hover:border-white/20 hover:bg-black/30 disabled:opacity-50 cursor-pointer"
          >
            Clica para selecionar ficheiro
          </button>
        </div>
      </div>

      {/* Status */}
      {ocrStatus && (
        <div className={`rounded p-2 text-xs mb-3 ${
          ocrStatus.startsWith("❌") ? "bg-red-500/10 text-red-400 border border-red-500/20"
          : ocrStatus.startsWith("✅") ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : ocrStatus.startsWith("⚠️") ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
          : "bg-white/5 text-gray-300 border border-white/10"
        }`}>
          {ocrProcessing && <span className="mr-2 inline-block animate-spin">⚙️</span>}
          {ocrStatus}
        </div>
      )}

      {/* Preview (só em separado quando ainda não há pesos detetados) */}
      {ocrPreview && ocrWeights.length === 0 && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Imagem analisada:</p>
          <img src={ocrPreview} alt="Preview" className="max-h-40 rounded border border-white/10" />
        </div>
      )}
      {ocrWeapon && (() => {
        const AMMO_PRECO: Record<string, number> = { "balas baixo": 150, "balas medio": 200, "balas alto": 250 };
        const ARMA_PRECO: Record<string, number> = { "arma baixo calibre": 20000, "arma medio calibre": 30000, "arma alto calibre": 80000 };
        const precoUnitAmmo = AMMO_PRECO[ocrWeapon.ammoItem] ?? 0;
        const coimaMunicao = ocrWeapon.ammo * precoUnitAmmo;
        const coimaAcessorios = ocrWeapon.accessoryCount * 5000;
        // Coima da ARMA em si (só no modo Coimas Rápidas — tabela de porte ilegal).
        const precoArma = mode === "coimas" ? (ARMA_PRECO[ocrWeapon.weaponItem] ?? 0) : 0;
        // Coima base de Posse de Munição (só no modo Coimas Rápidas, se houver munição).
        const coimaBaseMunicao = mode === "coimas" && ocrWeapon.ammo > 0 ? (CRIME_POSSE_MUNICAO?.multa ?? 0) : 0;
        const coimaTotal = coimaMunicao + coimaAcessorios + precoArma + coimaBaseMunicao;
        return (
          <div className="mb-2 rounded border border-amber-500/20 bg-amber-500/5 p-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">🔫 Captura da arma</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 text-[10px] text-gray-300">
              <div>Arma: <span className="text-gray-100">{ocrWeapon.weaponItem.replace("arma ", "").replace("calibre", "calibre")}</span></div>
              <div>Munição: <span className="text-gray-100">{ocrWeapon.ammo} {ocrWeapon.ammoItem}</span></div>
              <div>Acessórios: <span className="text-amber-300 font-bold">{ocrWeapon.accessoryCount}</span></div>
            </div>
            {coimaTotal > 0 && (
              <div className="mt-1.5 border-t border-amber-500/10 pt-1.5 text-[10px] text-gray-300">
                {ocrWeapon.ammo > 0 && (
                  <div>💰 {ocrWeapon.ammo} {ocrWeapon.ammoItem} x {precoUnitAmmo.toLocaleString("pt-PT")} € = <span className="text-amber-300 font-bold">{coimaMunicao.toLocaleString("pt-PT")} €</span></div>
                )}
                {ocrWeapon.accessoryCount > 0 && (
                  <div>💰 {ocrWeapon.accessoryCount} acessórios x 5.000 € = <span className="text-amber-300 font-bold">{coimaAcessorios.toLocaleString("pt-PT")} €</span></div>
                )}
                {precoArma > 0 && (
                  <div>💰 1 {ocrWeapon.weaponItem.replace("arma ", "")} x {precoArma.toLocaleString("pt-PT")} € = <span className="text-amber-300 font-bold">{precoArma.toLocaleString("pt-PT")} €</span></div>
                )}
                {coimaBaseMunicao > 0 && (
                  <div>⚖️ Posse de Munição (coima base) = <span className="text-amber-300 font-bold">{coimaBaseMunicao.toLocaleString("pt-PT")} €</span>{CRIME_POSSE_MUNICAO?.meses ? <span className="text-gray-500"> (+{CRIME_POSSE_MUNICAO.meses} meses)</span> : null}</div>
                )}
                <div className="mt-0.5 font-bold text-amber-200">Coima extra estimada: {coimaTotal.toLocaleString("pt-PT")} €</div>
              </div>
            )}
          </div>
        );
      })()}

      {(ocrWeights.length > 0 || ocrOverallConfidence != null) && (
        <div className="mb-2">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-gray-300">
              <BarChart3 className={`h-4 w-4 ${accentColor}`} />
              Probabilidades e Pesos
              <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-gray-300">{ocrWeights.length}</span>
            </h3>
            {ocrOverallConfidence != null && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-gray-500">
                Confiança global:
                <strong className={ocrOverallConfidence >= 80 ? "text-emerald-400" : ocrOverallConfidence >= 60 ? "text-yellow-400" : "text-red-400"}>{ocrOverallConfidence}%</strong>
              </span>
            )}
          </div>

          {ocrWeights.length > 0 ? (
            <div className={ocrPreview ? "grid items-start gap-3 md:grid-cols-[2fr_3fr]" : ""}>
              {ocrPreview && (
                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  <p className="px-2 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-500">Imagem analisada</p>
                  <img src={ocrPreview} alt="Imagem analisada" className="max-h-80 w-full object-cover" />
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-2">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-gray-500">
                      <th className="py-1.5 pr-2">Item</th>
                      <th className="py-1.5 pr-2 text-right">Qtd</th>
                      <th className="py-1.5 pr-2 text-right">Peso un.</th>
                      <th className="py-1.5 pr-2 text-right">Peso total</th>
                      <th className="py-1.5 px-2 text-center">Confiança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ocrWeights.map((w, i) => {
                      const def = ITEM_BY_NAME.get(w.item);
                      const confBadge =
                        w.confidenceLevel === "high"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : w.confidenceLevel === "medium"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-red-500/20 text-red-300";
                      const confBar =
                        w.confidenceLevel === "high"
                          ? "bg-emerald-500"
                          : w.confidenceLevel === "medium"
                            ? "bg-yellow-500"
                            : "bg-red-500";
                      const reasonTone =
                        w.matchReason.startsWith("Peso perfeito")
                          ? "text-emerald-400/80"
                          : w.matchReason.startsWith("Peso próximo")
                            ? "text-yellow-400/80"
                            : w.matchReason.startsWith("Peso divergente")
                              ? "text-red-400/80"
                              : "text-gray-500";
                      return (
                        <tr key={i} className="align-top">
                          <td className="py-1.5 pr-2">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-gray-100">
                                {def?.displayName || w.item}
                                {(def?.illegal || (w.item === "dinheiro" && w.qty > 10000)) && (
                                  <span className="ml-1.5 rounded bg-red-500/20 px-1 py-0.5 text-[8px] font-bold uppercase text-red-400">ilegal</span>
                                )}
                              </span>
                              {w.matchReason && (
                                <span className={`text-[9px] ${reasonTone}`}>{w.matchReason}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-1.5 pr-2 text-right font-mono text-gray-200">{w.qty.toLocaleString("pt-PT")}</td>
                          <td className="py-1.5 pr-2 text-right font-mono text-gray-500">{w.unitKg != null ? `${w.unitKg} kg` : "—"}</td>
                          <td className="py-1.5 pr-2 text-right font-mono font-semibold text-gray-100">{w.kg > 0 ? `${w.kg.toLocaleString("pt-PT")} kg` : "—"}</td>
                          <td className="py-1.5 px-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`rounded px-1.5 py-0.5 font-bold ${confBadge}`}>{w.confidence}%</span>
                              <div className="h-1 w-12 overflow-hidden rounded-full bg-gray-700">
                                <div className={`h-full ${confBar}`} style={{ width: `${w.confidence}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {ocrWeights.length > 0 && (
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/5">
                        <td className="py-1.5 pr-2 font-bold text-gray-300">Total</td>
                        <td className="py-1.5 pr-2 text-right font-bold text-gray-200">{ocrTotalQty.toLocaleString("pt-PT")}</td>
                        <td className="py-1.5 pr-2" />
                        <td className="py-1.5 pr-2 text-right font-bold text-gray-100">{ocrTotalKg.toLocaleString("pt-PT")} kg</td>
                        <td className="py-1.5 px-2" />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          ) : (
            <div className="mt-1 rounded border border-white/10 bg-black/40 p-2 text-[10px] text-gray-500">
              Nenhum peso reconhecido.
            </div>
          )}
        </div>
      )}

      {ocrRawText && (
        <details className="mb-2">
          <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300">🔍 Ver texto OCR bruto</summary>
          <pre className="mt-1 max-h-32 overflow-y-auto rounded border border-white/10 bg-black/40 p-2 text-[10px] text-gray-500 whitespace-pre-wrap">{ocrRawText}</pre>
        </details>
      )}
    </div>
  );
}
