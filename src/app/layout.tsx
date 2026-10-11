import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { Toaster } from "@/components/ui/sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mobilehubbd.tech";
const siteUrl = rawSiteUrl.startsWith("http") ? rawSiteUrl : `https://${rawSiteUrl}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MobileHubBD - Premium Smartphone Parts & Repair Services",
    template: "%s | MobileHubBD",
  },
  description:
    "Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services - MobileHubBD",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "MobileHubBD",
    title: "MobileHubBD - Premium Smartphone Parts & Repair Services",
    description:
      "Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MobileHubBD - Premium Smartphone Parts & Repair Services",
    description:
      "Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services.",
  },
};

import { API_BASE_URL } from "@/lib/api-client";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolvedApiUrl = API_BASE_URL;
  if (typeof window === "undefined") {
    console.log(`[MobileHubBD Server Startup] API URL resolved: ${resolvedApiUrl}`);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <CartProvider>
            {children}
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
