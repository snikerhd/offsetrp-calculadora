import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { parseInventoryOCR } from "@/lib/ocr-parser";
import { openaiOcr } from "@/lib/openai-ocr";
import { puterOcr } from "@/lib/puter-ocr";

export const maxDuration = 60;
export const runtime = "nodejs";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = process.env.OCR_SPACE_KEY || "helloworld";
const OCR_SPACE_TIMEOUT_MS = 15_000;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
const ENGINES_CAP_MS = 30_000;
const OPENAI_TIMEOUT_MS = 25_000;
const PUTER_TIMEOUT_MS = 25_000;
const TESS_CACHE_PATH = join(process.cwd(), ".cache", "tessdata");
try { mkdirSync(TESS_CACHE_PATH, { recursive: true }); } catch {}

type SharpModule = typeof import("sharp");
type Sharp = { default?: SharpModule } & SharpModule;
let sharpModule: Sharp | null = null;
async function getSharp(): Promise<Sharp | null> {
  if (sharpModule) return sharpModule;
  try { sharpModule = (await import("sharp")) as unknown as Sharp; return sharpModule; }
  catch (e) { console.error("sharp import failed:", e); return null; }
}

type TesseractWorker = { recognize: (input: Buffer) => Promise<{ data: { text?: string } }> };
let tesseractModule: typeof import("tesseract.js") | null = null;
async function getTesseractModule(): Promise<typeof import("tesseract.js") | null> {
  if (tesseractModule) return tesseractModule;
  try { tesseractModule = await import("tesseract.js"); return tesseractModule; }
  catch (e) { console.error("tesseract.js import failed:", e); return null; }
}
let workerPromise: Promise<TesseractWorker | null> | null = null;
function resolveTesseractWorkerPath(): string {
  const viaCwd = join(process.cwd(), "node_modules", "tesseract.js", "src", "worker-script", "node", "index.js");
  if (existsSync(viaCwd)) return viaCwd;
  try { return require.resolve("tesseract.js/src/worker-script/node/index.js"); } catch { return viaCwd; }
}
function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tesseract = await getTesseractModule();
      if (!tesseract) return null;
      return tesseract.createWorker("por", 1, {
        workerPath: resolveTesseractWorkerPath(),
        langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int",
        cachePath: TESS_CACHE_PATH,
        errorHandler: (e: unknown) => console.error("tesseract worker error:", e),
      });
    })().catch(e => { console.error("tesseract worker init failed:", e); workerPromise = null; throw e; });
  }
  return workerPromise;
}
async function preprocessImage(base64Data: string): Promise<Buffer> {
  const buf = Buffer.from(base64Data, "base64");
  const sharpFn = await getSharp();
  if (!sharpFn) return buf;
  try {
    const s = sharpFn.default ?? sharpFn;
    const meta = await s(buf).metadata();
    const w = meta.width || 0, h = meta.height || 0;
    const scale = Math.min(2, 2400 / Math.max(w || 1, h || 1));
    return s(buf).resize(Math.round(Math.max(1, w * scale)), Math.round(Math.max(1, h * scale))).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  } catch { return buf; }
}
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); } finally { clearTimeout(timer); }
}
async function ocrSpace(processed: Buffer): Promise<string> {
  try {
    const formBody = new URLSearchParams();
    formBody.append("base64Image", `data:image/jpeg;base64,${processed.toString("base64")}`);
    formBody.append("language", "por"); formBody.append("isOverlayRequired", "false"); formBody.append("isTable", "true"); formBody.append("OCREngine", "2");
    const r = await fetchWithTimeout(OCR_SPACE_URL, { method: "POST", headers: { apikey: OCR_SPACE_KEY, "Content-Type": "application/x-www-form-urlencoded" }, body: formBody.toString() }, OCR_SPACE_TIMEOUT_MS);
    if (!r.ok) return ""; const data = await r.json(); return (data.ParsedResults?.[0]?.ParsedText || "").trim();
  } catch { return ""; }
}
async function tesseractOcr(processed: Buffer): Promise<string> {
  try { const worker = await getWorker(); if (!worker) return ""; const { data } = await Promise.race([
    worker.recognize(processed),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("tesseract timeout")), ENGINES_CAP_MS)),
  ]); return (data.text || "").trim(); }
  catch { return ""; }
}
async function openaiOcrWithTimeout(processed: Buffer): Promise<string> {
  const b64 = processed.toString("base64");
  return new Promise(resolve => { const timer = setTimeout(() => resolve(""), OPENAI_TIMEOUT_MS); openaiOcr(b64).then(t => { clearTimeout(timer); resolve(t); }).catch(() => { clearTimeout(timer); resolve(""); }); });
}
async function puterOcrWithTimeout(processed: Buffer): Promise<string> {
  const b64 = processed.toString("base64");
  return new Promise(resolve => { const timer = setTimeout(() => resolve(""), PUTER_TIMEOUT_MS); puterOcr(b64).then(t => { clearTimeout(timer); resolve(t); }).catch(() => { clearTimeout(timer); resolve(""); }); });
}
// Junta as leituras dos vários motores sem duplicar linhas: cada motor apanha
// zonas diferentes da screenshot (um lê a grelha, outro o bloco de resumo),
// e o parser usa o que estiver mais completo.
function mergeEngineTexts(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    for (const raw of (part || "").split("\n")) {
      const line = raw.trim();
      if (line.length < 2) continue;
      const key = line.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
  }
  return out.join("\n");
}
async function collectEngineTexts(primary: Promise<string>, a: Promise<string>, b: Promise<string>): Promise<string> {
  const parts = await Promise.all([primary, a, b]);
  return mergeEngineTexts(parts);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime, rawText } = body;
    if (rawText && typeof rawText === "string" && rawText.trim().length >= 3) {
      const parsed = parseInventoryOCR(rawText.trim());
      let rawPreview: string | undefined;
      if (imageUrl) {
        try {
          let directUrl = imageUrl as string;
          if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.gyazo.com/${id}.png`; }
          if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.imgur.com/${id}.png`; }
          const r = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" }, IMAGE_FETCH_TIMEOUT_MS);
          if (r.ok) rawPreview = `data:${r.headers.get("content-type") || "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
        } catch {}
      }
      return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: rawText.trim(), preview: rawPreview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
    }
    let base64Data: string, mimeType: string;
    if (imageBase64) { base64Data = imageBase64; mimeType = inputMime || "image/png"; }
    else if (imageUrl) {
      let directUrl = imageUrl as string;
      if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.gyazo.com/${id}.png`; }
      if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) { const id = directUrl.split("/").pop()?.split("?")[0]; if (id) directUrl = `https://i.imgur.com/${id}.png`; }
      const r = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" }, redirect: "follow" }, IMAGE_FETCH_TIMEOUT_MS);
      if (!r.ok) return NextResponse.json({ error: `Falha ao obter imagem: ${r.status} ${r.statusText}` }, { status: 400 });
      base64Data = Buffer.from(await r.arrayBuffer()).toString("base64"); mimeType = r.headers.get("content-type") || "image/png";
    } else return NextResponse.json({ error: "imageUrl ou imageBase64 necessário" }, { status: 400 });
    const preview = `data:${mimeType};base64,${base64Data}`;
    const processed = await preprocessImage(base64Data);
    const ocrText = await collectEngineTexts(puterOcrWithTimeout(processed), ocrSpace(processed), tesseractOcr(processed));
    if (ocrText.length < 3) return NextResponse.json({ result: "", ocrRaw: "", preview, error: "Não foi possível extrair texto da imagem. Tenta uma screenshot mais nítida." });
    const parsed = parseInventoryOCR(ocrText);
    return NextResponse.json({ result: parsed.text, detectedWeights: parsed.weights, overallConfidence: parsed.overallConfidence, weaponCapture: parsed.weaponCapture ?? null, ocrRaw: ocrText, preview, error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente." });
  } catch (error) { const msg = error instanceof Error ? error.message : "Erro desconhecido"; console.error("API error:", msg); return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 }); }
}
