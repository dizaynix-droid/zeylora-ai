import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appConfig } from "@/config/app";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata();

export const viewport: Viewport = {
  themeColor: "#03050D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={appConfig.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
