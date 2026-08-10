import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calculadora Offset-RP | Coimas & Análise de Foto",
  description: "Calculadora de coimas para Offset RP com análise OCR de screenshots do inventário.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt">
      <body className="bg-[#0a0e17] text-gray-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
