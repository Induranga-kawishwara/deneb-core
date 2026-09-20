import type { Metadata } from "next";
import type { ReactNode } from "react";
import siteData from "@/data/site-data.json";
import { SiteDataProvider, ThemeStyles } from "@/lib/siteDataContext";
import SiteChrome from "@/components/SiteChrome";
import './globals.css';
import '../fonts/deneb-fonts.css';

export async function generateMetadata(): Promise<Metadata> {
  const sd = siteData as any;
  const common = sd?.content?.common;
  const shop = sd?.shop;

  const title =
    common?.websiteTitle ||
    shop?.businessName ||
    "Storefront";

  const description =
    common?.shortDescription ||
    shop?.description ||
    "A modern digital storefront powered by Fivora DENEB UI.";

  const icon =
    common?.logoUrl ||
    shop?.logoUrl ||
    "/fivora-icon.svg";

  return {
    title,
    description,
    icons: {
      icon,
      shortcut: icon,
      apple: icon,
    },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const initialTheme =
    (siteData as any)?.template?.structure?.theme || (siteData as any)?.theme;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeStyles theme={initialTheme} enableDualMode />
      </head>
      <body suppressHydrationWarning>
        <SiteDataProvider initialSiteData={siteData}>
          <SiteChrome>{children}</SiteChrome>
        </SiteDataProvider>
      </body>
    </html>
  );
}
