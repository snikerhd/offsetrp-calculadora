import { NextRequest, NextResponse } from "next/server";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { parseInventoryOCR } from "@/lib/ocr-parser";
import { openaiOcr } from "@/lib/openai-ocr";
import { puterOcr } from "@/lib/puter-ocr";

// Vercel (Hobby) corta funções aos 10s por omissão; o OCR pode demorar até
// 30s (cap dos motores). Este limite evita 504 quando o Puter/fallbacks
// penduram (máximo permitido no Hobby: 60s).
export const maxDuration = 60;
export const runtime = "nodejs";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = process.env.OCR_SPACE_KEY || "helloworld";
// O OCR.space (chave demo "helloworld") pode ficar pendurado sem resposta. Sem
// timeout, o pedido fica "A analisar imagem com OCR..." para sempre. 15s é o
// suficiente para a chave normal responder; acima disso usamos o tesseract.
const OCR_SPACE_TIMEOUT_MS = 15_000;
const IMAGE_FETCH_TIMEOUT_MS = 20_000;
// Nenhum motor pode exceder isto — a rota responde sempre com JSON.
const ENGINES_CAP_MS = 30_000;
// OpenAI é o motor primário; acima disto caímos para OCR.space/tesseract.
const OPENAI_TIMEOUT_MS = 25_000;
// Puter.js (img2txt) é o novo primário; timeout folgado para o modelo dar resposta.
const PUTER_TIMEOUT_MS = 25_000;

// Cache persistente do modelo por.traineddata (ficheiro ~11MB). O tmpdir é
// limpo a cada reboot e obriga a re-download em cada arranque.
const TESS_CACHE_PATH = join(process.cwd(), ".cache", "tessdata");
try {
  mkdirSync(TESS_CACHE_PATH, { recursive: true });
} catch { /* empty */ }

// sharp e tesseract.js são importados em runtime (lazy) porque no serverless
// (Vercel/Turbopack) o import estático pode rebentar o carregamento do módulo
// da rota — o que devolvia 500 com HTML em vez de JSON. Com load lazy e
// try/catch, se um motor falhar ao carregar os restantes continuam a correr.
type SharpModule = typeof import("sharp");
type Sharp = { default?: SharpModule } & SharpModule;

let sharpModule: Sharp | null = null;
async function getSharp(): Promise<Sharp | null> {
  if (sharpModule) return sharpModule;
  try {
    sharpModule = (await import("sharp")) as unknown as Sharp;
    return sharpModule;
  } catch (e) {
    console.error("sharp import failed:", e);
    return null;
  }
}

type TesseractWorker = {
  recognize: (input: Buffer) => Promise<{ data: { text?: string } }>;
};

let tesseractModule: typeof import("tesseract.js") | null = null;
async function getTesseractModule(): Promise<typeof import("tesseract.js") | null> {
  if (tesseractModule) return tesseractModule;
  try {
    tesseractModule = await import("tesseract.js");
    return tesseractModule;
  } catch (e) {
    console.error("tesseract.js import failed:", e);
    return null;
  }
}

let workerPromise: Promise<TesseractWorker | null> | null = null;

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
    workerPromise = (async () => {
      const tesseract = await getTesseractModule();
      if (!tesseract) return null;
      return tesseract.createWorker("por", 1, {
        workerPath: resolveTesseractWorkerPath(),
        langPath: "https://cdn.jsdelivr.net/npm/@tesseract.js-data/por/4.0.0_best_int",
        cachePath: TESS_CACHE_PATH,
        errorHandler: (e: unknown) => console.error("tesseract worker error:", e),
      });
    })().catch((e) => {
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
  const sharpFn = await getSharp();
  if (!sharpFn) return buf;
  try {
    const s = sharpFn.default ?? sharpFn;
    const meta = await s(buf).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    const scale = Math.min(2, 2400 / Math.max(w || 1, h || 1));
    return s(buf)
      .resize(Math.round(Math.max(1, w * scale)), Math.round(Math.max(1, h * scale)))
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch (e) {
    console.error("preprocess failed, using raw image:", e);
    return buf;
  }
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
    if (!worker) return "";
    const { data } = await worker.recognize(processed);
    return (data.text || "").trim();
  } catch (err) {
    console.error("tesseract fallback error:", err);
    return "";
  }
}

// OpenAI com timeout próprio — se ultrapassar, devolve "" e os outros motores
// assumem.
async function openaiOcrWithTimeout(processed: Buffer): Promise<string> {
  const b64 = processed.toString("base64");
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(""), OPENAI_TIMEOUT_MS);
    openaiOcr(b64)
      .then((t) => {
        clearTimeout(timer);
        resolve(t);
      })
      .catch((e) => {
        console.error("OpenAI OCR error:", e);
        clearTimeout(timer);
        resolve("");
      });
  });
}

// Puter.js (img2txt) com timeout próprio — usa o auth token da tua conta
// (sem login do visitante). Devolve "" se falhar e os outros motores assumem.
async function puterOcrWithTimeout(processed: Buffer): Promise<string> {
  const b64 = processed.toString("base64");
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(""), PUTER_TIMEOUT_MS);
    puterOcr(b64)
      .then((t) => {
        clearTimeout(timer);
        resolve(t);
      })
      .catch((e) => {
        console.error("Puter OCR error:", e);
        clearTimeout(timer);
        resolve("");
      });
  });
}

// OpenAI é o motor primário (rotação de chaves em openai-ocr.ts). Usa-se o
// primeiro texto útil entre os motores; OpenAI tem precedência quando devolve
// texto, e o cap garante resposta JSON mesmo que tudo pendure.
function firstUsefulText(
  primary: Promise<string>,
  a: Promise<string>,
  b: Promise<string>
): Promise<string> {
  return new Promise((resolve) => {
    let done = false;
    let primaryText = "";
    const finish = (val: string, isPrimary: boolean) => {
      if (done) return;
      const t = val.trim();
      if (isPrimary && t.length >= 3) {
        done = true;
        resolve(t);
        return;
      }
      if (!isPrimary && t.length >= 3) {
        primaryText = primaryText || t;
      }
    };
    primary.then((v) => {
      const t = (v || "").trim();
      if (t.length >= 3) {
        if (done) return;
        done = true;
        resolve(t);
        return;
      }
      finish(v, false);
      // Se o primário falhou, deixa os secundários decidirem.
    });
    a.then((v) => finish(v, false));
    b.then((v) => finish(v, false));
    const capTimer = setTimeout(() => {
      if (done) return;
      done = true;
      const p = primaryText.trim();
      resolve(p.length >= 3 ? p : "");
    }, ENGINES_CAP_MS);
    Promise.all([primary, a, b]).then(([pv, av, bv]) => {
      if (done) return;
      clearTimeout(capTimer);
      done = true;
      const candidates = [pv, av, bv].map((v) => (v || "").trim()).filter((v) => v.length >= 3);
      resolve(candidates[0] || "");
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, imageBase64, mimeType: inputMime, rawText } = body;

    // Modo "só parsing": o texto já foi extraído no navegador (Puter.js). O
    // servidor recebe o rawText e apenas o converte em itens/pesos. O preview
    // é devolvido tal como no fluxo normal (imagem ou placeholder quando o
    // cliente só enviou texto).
    if (rawText && typeof rawText === "string" && rawText.trim().length >= 3) {
      const parsed = parseInventoryOCR(rawText.trim());
      let rawPreview: string | undefined;
      if (imageUrl) {
        try {
          let directUrl = imageUrl as string;
          if (directUrl.includes("gyazo.com") && !directUrl.includes("i.gyazo.com")) {
            const id = directUrl.split("/").pop()?.split("?")[0];
            if (id) directUrl = `https://i.gyazo.com/${id}.png`;
          }
          if (directUrl.includes("imgur.com") && !directUrl.includes("i.imgur.com")) {
            const id = directUrl.split("/").pop()?.split("?")[0];
            if (id) directUrl = `https://i.imgur.com/${id}.png`;
          }
          const imgResp = await fetchWithTimeout(directUrl, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" }, IMAGE_FETCH_TIMEOUT_MS);
          if (imgResp.ok) {
            const ab = await imgResp.arrayBuffer();
            const mt = imgResp.headers.get("content-type") || "image/png";
            rawPreview = `data:${mt};base64,${Buffer.from(ab).toString("base64")}`;
          }
        } catch {
          rawPreview = undefined;
        }
      }
      return NextResponse.json({
        result: parsed.text,
        detectedWeights: parsed.weights,
        overallConfidence: parsed.overallConfidence,
        weaponCapture: parsed.weaponCapture ?? null,
        ocrRaw: rawText.trim(),
        preview: rawPreview,
        error: parsed.text || parsed.weaponCapture ? undefined : "Não foram identificados itens automaticamente.",
      });
    }

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

    // Modo diagnóstico (?diag=1): só o motor primário (Puter), com timeout
    // curto, para verificar se o token está configurado no ambiente e se o
    // SDK responde no serverless (os fallbacks penduram em sandbox).
    if (req.nextUrl.searchParams.get("diag") === "1") {
      const tok = process.env.PUTER_AUTH_TOKEN || "";
      const b64 = processed.toString("base64");
      const d0 = Date.now();
      const puter = await new Promise<string>((resolve) => {
        const timer = setTimeout(() => resolve(""), 12_000);
        puterOcr(b64)
          .then((t) => { clearTimeout(timer); resolve(t); })
          .catch((e) => { clearTimeout(timer); console.error("Puter diag error:", e); resolve(""); });
      });
      const puterMs = Date.now() - d0;
      return NextResponse.json({
        diag: {
          puterTokenConfigured: tok.length >= 10,
          puterTokenLen: tok.length,
          puter: { ms: puterMs, len: puter.length, preview: puter.slice(0, 150) },
        },
      });
    }

    // Corre Puter (primário), OCR.space (com timeout) e o tesseract local em
    // paralelo. Puter tem precedência quando devolve texto; os restantes são
    // fallback quando a API externa falha, fica sem quota ou pendura.
    const ocrText = await firstUsefulText(
      puterOcrWithTimeout(processed),
      ocrSpace(processed),
      tesseractOcr(processed)
    );

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