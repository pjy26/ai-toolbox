import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { MembershipProvider } from "@/components/membership-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { PwaRegister } from "@/components/pwa-register";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.amarapjy.xyz";
const title = "Amara · Not just remembered. Truly understood.";
const description = "Amara grows with you—building relationship continuity, deep understanding, shared growth, a unique personality, and warm companionship over time.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  applicationName: "Amara",
  description,
  openGraph: {
    type: "website",
    siteName: "Amara",
    title,
    description,
    locale: "en_US",
    alternateLocale: ["zh_CN"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Amara",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "waffo-verify": "e380c83311d7ed59ed0b12f763e69006",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F5EF",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable} min-h-screen antialiased`}>
        <AuthProvider>
          <MembershipProvider>
            <LocaleProvider>{children}</LocaleProvider>
          </MembershipProvider>
        </AuthProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
