import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScanServe.qr — Digital Menus for Modern Restaurants",
  description:
    "Turn any table into a contactless ordering experience. Create beautiful QR menus, update in real time, and grow your restaurant with smart analytics.",
  keywords: ["QR menu", "digital menu", "restaurant SaaS", "contactless ordering", "ScanServe"],
  openGraph: {
    title: "ScanServe.qr — Digital Menus for Modern Restaurants",
    description:
      "Turn any table into a contactless ordering experience. Create beautiful QR menus, update in real time.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
