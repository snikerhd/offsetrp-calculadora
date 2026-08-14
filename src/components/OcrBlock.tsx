"use client";

import { useState, useRef, useCallback } from "react";
import { Camera } from "lucide-react";

interface OcrBlockProps {
  inputCls: string;
  fillBtnTheme: string;
  neonShadow: string;
  accentColor: string;
  onResult: (txt: string) => void;
}

export default function OcrBlock({ inputCls, fillBtnTheme, neonShadow, accentColor, onResult }: OcrBlockProps) {
  const [ocrUrl, setOcrUrl] = useState("");
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState("");
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState("");
  const [ocrWeights, setOcrWeights] = useState<{ item: string; qty: number; kg: number; unitKg: number | null }[]>([]);
  const [ocrWeapon, setOcrWeapon] = useState<{ weaponItem: string; ammo: number; ammoItem: string; accessoryCount: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleResult = useCallback((data: {
    result?: string;
    preview?: string;
    error?: string;
    ocrRaw?: string;
    detectedWeights?: { item: string; qty: number; kg: number; unitKg: number | null }[];
    weaponCapture?: { weaponItem: string; ammo: number; ammoItem: string; accessoryCount: number } | null;
  }) => {
    if (data.preview) setOcrPreview(data.preview);
    if (data.ocrRaw) setOcrRawText(data.ocrRaw);
    setOcrWeights(data.detectedWeights || []);
    setOcrWeapon(data.weaponCapture || null);

    if (data.error && !data.result) {
      setOcrStatus(`❌ ${data.error}`);
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
      const resp = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: ocrUrl.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok && !data.result) throw new Error(data.error || `Erro ${resp.status}`);
      handleResult(data);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      setOcrStatus(`❌ ${msg}`);
      setOcrProcessing(false);
    }
  }, [ocrUrl, handleResult]);

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
          const resp = await fetch("/api/ocr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageBase64: match[2], mimeType: match[1] }),
          });
          const data = await resp.json();
          if (!resp.ok && !data.result) throw new Error(data.error || `Erro ${resp.status}`);
          handleResult(data);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Erro desconhecido";
          setOcrStatus(`❌ ${msg}`);
          setOcrProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    },
    [handleResult]
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

      {/* Preview + Raw OCR */}
      {ocrPreview && (
        <div className="mb-3">
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">Imagem analisada:</p>
          <img src={ocrPreview} alt="Preview" className="max-h-40 rounded border border-white/10" />
        </div>
      )}
      {ocrWeapon && (() => {
        const AMMO_PRECO: Record<string, number> = { "balas baixo": 500, "balas medio": 1000, "balas alto": 1500 };
        const precoUnitAmmo = AMMO_PRECO[ocrWeapon.ammoItem] ?? 0;
        const coimaMunicao = ocrWeapon.ammo * precoUnitAmmo;
        const coimaAcessorios = ocrWeapon.accessoryCount * 5000;
        const coimaTotal = coimaMunicao + coimaAcessorios;
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
                <div className="mt-0.5 font-bold text-amber-200">Coima extra estimada: {coimaTotal.toLocaleString("pt-PT")} €</div>
              </div>
            )}
          </div>
        );
      })()}

      {ocrWeights.length > 0 && (
        <details className="mb-2" open>
          <summary className="cursor-pointer text-[10px] text-gray-500 hover:text-gray-300">
            ⚖️ Pesos reconhecidos ({ocrWeights.length})
          </summary>
          <div className="mt-1 grid grid-cols-2 md:grid-cols-3 gap-1 rounded border border-white/10 bg-black/40 p-2">
            {ocrWeights.map((w) => (
              <div key={w.item} className="text-[10px] text-gray-400">
                <span className="text-gray-200">{w.qty}x {w.item}</span>: {w.kg} kg
                {w.unitKg != null && <span className="text-gray-600"> ({w.unitKg} kg/un.)</span>}
              </div>
            ))}
          </div>
        </details>
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
