import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JARVIS — Mission Control",
  description: "Personal mission control dashboard",
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "JARVIS",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#04080c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          data-* attributes on <body> before hydration — harmless, ignore. */}
      <body className="min-h-full" suppressHydrationWarning>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
