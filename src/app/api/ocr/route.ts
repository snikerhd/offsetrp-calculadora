import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { parseInventoryOCR } from "@/lib/ocr-parser";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = process.env.OCR_SPACE_KEY || "helloworld";
// O OCR.space (chave demo "helloworld") pode ficar pendurado sem resposta. Sem
// timeout, o pedido fica "A analisar imagem com OCR..." para sempre. 15s é o
// suficiente para a chave normal responder; acima disso usamos o tesseract.
const OCR_SPACE_TIMEOUT_MS = 15_000;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
// Nenhum motor pode exceder isto — a rota responde sempre com JSON.
const ENGINES_CAP_MS = 30_000;

// Cache persistente do modelo por.traineddata (ficheiro ~11MB). O tmpdir é
// limpo a cada reboot e obriga a re-download em cada arranque.
const TESS_CACHE_PATH = join(process.cwd(), ".cache", "tessdata");
try {
  mkdirSync(TESS_CACHE_PATH, { recursive: true });
} catch { /* empty */ }

let workerPromise: Promise<Awaited<ReturnType<typeof createWorker>>> | null = null;

// Em Next.js (Turbopack) o `__dirname` interno do tesseract.js é reescrito para
// um caminho inválido ("C:\ROOT\node_modules\..."), o que rebenta o spawn do
// worker (`new Worker(workerPath)`) e deixa o OCR pendurado. Resolve aqui o
// caminho real do worker-script a partir da raiz do projeto.
function resolveTesseractWorkerPath(): string {
  const viaCwd = join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
  if (existsSync(viaCwd)) return viaCwd;
  try {
    return require.resolve("tesseract.js/src/worker-script/node/index.js");
  } catch {
    return viaCwd;
  }
}

function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker("por", 1, {
      workerPath: resolveTesseractWorkerPath(),
      langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int",
      cachePath: TESS_CACHE_PATH,
      errorHandler: (e: unknown) => console.error("tesseract worker error:", e),
    }).catch((e) => {
      console.error("tesseract worker init failed:", e);
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

// OCR.space (OCREngine 2) devolve texto vazio em PNGs RGBA e em screenshots
// pequenas. Upscale 2x + conversão para JPEG resolve; o tesseract.js local
// serve de fallback quando a API externa falha ou fica sem quota.
// O scale é limitado: nunca ultrapassa ~2400px na maior dimensão. Aplicar 2x
// a screenshots grandes só quadruplica os pixels e torna a API e o tesseract
// mais lentos sem ganho de precisão.
async function preprocessImage(base64Data: string): Promise<Buffer> {
  const buf = Buffer.from(base64Data, "base64");
  const meta = await sharp(buf).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  const scale = Math.min(2, 2400 / Math.max(w || 1, h || 1));
  return sharp(buf)
    .resize(Math.round(Math.max(1, w * scale)), Math.round(Math.max(1, h * scale)))
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ocrSpace(processed: Buffer): Promise<string> {
  try {
    const formBody = new URLSearchParams();
    formBody.append("base64Image", `data:image/jpeg;base64,${processed.toString("base64")}`);
    formBody.append("language", "por");
    formBody.append("isOverlayRequired", "false");
    formBody.append("isTable", "true");
    formBody.append("OCREngine", "2");

    const ocrResp = await fetchWithTimeout(
      OCR_SPACE_URL,
      {
        method: "POST",
        headers: {
          apikey: OCR_SPACE_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
      },
      OCR_SPACE_TIMEOUT_MS
    );

    if (!ocrResp.ok) return "";
    const ocrData = await ocrResp.json();
    return (ocrData.ParsedResults?.[0]?.ParsedText || "").trim();
  } catch (err) {
    console.error("OCR.space error:", err);
    return "";
  }
}

async function tesseractOcr(processed: Buffer): Promise<string> {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(processed);
    return (data.text || "").trim();
  } catch (err) {
    console.error("tesseract fallback error:", err);
    return "";
  }
}

// Devolve o primeiro texto útil entre os dois motores (tesseract local é
// rápido; OCR.space é melhor mas pode pendurar até ao timeout). Um cap garante
// que a rota responde sempre com JSON, mesmo que um motor fique pendurado.
function firstUsefulText(a: Promise<string>, b: Promise<string>): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val: string) => {
      if (done) return;
      const t = val.trim();
      if (t.length >= 3) {
        done = true;
        resolve(t);
      }
    };
    a.then(finish);
    b.then(finish);
    const capTimer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve("");
    }, ENGINES_CAP_MS);
    Promise.all([a, b]).then(([av, bv]) => {
      if (done) return;
      clearTimeout(capTimer);
      done = true;
      const preferred = av && av.trim().length >= 3 ? av : bv && bv.trim().length >= 3 ? bv : "";
      resolve(preferred.trim());
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime } = body;

    let base64Data: string;
    let mimeType: string;

    if (imageBase64) {
      base64Data = imageBase64;
      mimeType = inputMime || "image/png";
    } else if (imageUrl) {
      let directUrl = imageUrl as string;
      if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) {
        const id = directUrl.split("/").pop()?.split("?")[0];
        if (id) directUrl = `https://i.gyazo.com/${id}.png`;
      }
      if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) {
        const id = directUrl.split("/").pop()?.split("?")[0];
        if (id) directUrl = `https://i.imgur.com/${id}.png`;
      }

      const imgResp = await fetchWithTimeout(
        directUrl,
        {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "image/*,*/*",
          },
          redirect: "follow",
        },
        IMAGE_FETCH_TIMEOUT_MS
      );

      if (!imgResp.ok) {
        return NextResponse.json(
          { error: `Falha ao obter imagem: ${imgResp.status} ${imgResp.statusText}` },
          { status: 400 }
        );
      }

      const ab = await imgResp.arrayBuffer();
      base64Data = Buffer.from(ab).toString("base64");
      mimeType = imgResp.headers.get("content-type") || "image/png";
    } else {
      return NextResponse.json({ error: "imageUrl ou imageBase64 necessário" }, { status: 400 });
    }

    const preview = `data:${mimeType};base64,${base64Data}`;
    const processed = await preprocessImage(base64Data);

    // Corre OCR.space (com timeout) e o tesseract local em paralelo e usa o
    // primeiro que devolver texto útil. Assim, se a API externa pendurar ou
    // estiver sem quota, o tesseract (rápido) responde logo.
    const ocrText = await firstUsefulText(ocrSpace(processed), tesseractOcr(processed));

    if (ocrText.length < 3) {
      return NextResponse.json({
        result: "",
        ocrRaw: ocrText || "",
        preview,
        error: "Não foi possível extrair texto da imagem. Tenta uma screenshot mais nítida.",
      });
    }

    const parsed = parseInventoryOCR(ocrText);

    return NextResponse.json({
      result: parsed.text,
      detectedWeights: parsed.weights,
      overallConfidence: parsed.overallConfidence,
      weaponCapture: parsed.weaponCapture ?? null,
      ocrRaw: ocrText,
      preview,
      error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("API error:", msg);
    return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 });
  }
}