import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { appConfig } from "@/config/app";
import { MarketingBodyScripts, MarketingHeadTags } from "@/components/analytics/marketing-scripts";
import { PageTracker } from "@/components/analytics/page-tracker";
import { ReferralTracker } from "@/components/affiliate/referral-tracker";
import { createMetadata } from "@/lib/seo";

export const metadata: Metadata = createMetadata();

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  colorScheme: "light",
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
      <head>
        <MarketingHeadTags />
      </head>
      <body>
        {children}
        <Suspense fallback={null}>
          <PageTracker />
          <ReferralTracker />
        </Suspense>
        <MarketingBodyScripts />
      </body>
    </html>
  );
}
