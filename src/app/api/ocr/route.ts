import { NextRequest, NextResponse } from "next/server";
import { parseInventoryOCR } from "@/lib/ocr-parser";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";
const OCR_SPACE_KEY = "helloworld";

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

      const imgResp = await fetch(directUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "image/*,*/*",
        },
        redirect: "follow",
      });

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
    let ocrText = "";

    try {
      const formBody = new URLSearchParams();
      formBody.append("base64Image", `data:${mimeType};base64,${base64Data}`);
      formBody.append("language", "por");
      formBody.append("isOverlayRequired", "false");
      formBody.append("isTable", "true");
      formBody.append("OCREngine", "2");

      const ocrResp = await fetch(OCR_SPACE_URL, {
        method: "POST",
        headers: {
          apikey: OCR_SPACE_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
      });

      if (ocrResp.ok) {
        const ocrData = await ocrResp.json();
        if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
          ocrText = ocrData.ParsedResults
            .map((r: { ParsedText?: string }) => r.ParsedText || "")
            .join("\n");
        }
      }
    } catch (ocrErr) {
      console.error("OCR.space error:", ocrErr);
    }

    if (!ocrText || ocrText.trim().length < 3) {
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
      error: parsed.text ? undefined : "Não foram identificados itens automaticamente.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("API error:", msg);
    return NextResponse.json({ error: `Falha: ${msg}` }, { status: 500 });
  }
}
