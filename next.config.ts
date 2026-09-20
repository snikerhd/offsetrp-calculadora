import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // Garante que o motor de OCR (tesseract.js: worker, core WASM) e os dados de
  // língua (por.traineddata, carregado via process.cwd() em runtime) ficam
  // incluídos no bundle da lambda no Vercel. Sem isto, o output file tracing
  // não os apanha (são acedidos dinamicamente) e o OCR falha em produção com
  // "tesseract worker init failed".
  outputFileTracingIncludes: {
    "/api/ocr": ["./por.traineddata", "./node_modules/tesseract.js/**", "./node_modules/tesseract.js-core/**"],
  },
};

export default nextConfig;
