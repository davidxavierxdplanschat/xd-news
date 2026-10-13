import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Panorama — Notícias em português", description: "Uma janela para o mundo. Leitor independente de notícias do New York Times, com tradução de títulos e resumos para português.", icons: { icon: "/icon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
