import type { Metadata } from "next";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arqive AI | Rapor Otomasyonu",
  description: "Kanıta dayalı profesyonel rapor oluşturma platformu.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
