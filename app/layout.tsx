/* WatchList — versão em lib/config.ts (APP_VERSION) */
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import { APP_NAME, THEME_COLOR } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// iOS ignores the web manifest's icons for the PWA launch screen — without
// these, tapping the home-screen icon shows a plain white screen until the
// first paint. Sizes cover the CSS(w x h)@dpr combos across iPhone models;
// images are pre-rendered (icon centered on THEME_COLOR) in public/splash/,
// generated from public/icons/icon-512.png.
const startupImage = (
  file: string,
  width: number,
  height: number,
  ratio: number
) => ({
  url: `/splash/${file}`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Track the movies and TV shows you watch.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
    startupImage: [
      startupImage("640x1136.png", 320, 568, 2),
      startupImage("750x1334.png", 375, 667, 2),
      startupImage("1242x2208.png", 414, 736, 3),
      startupImage("1125x2436.png", 375, 812, 3),
      startupImage("828x1792.png", 414, 896, 2),
      startupImage("1242x2688.png", 414, 896, 3),
      startupImage("1170x2532.png", 390, 844, 3),
      startupImage("1284x2778.png", 428, 926, 3),
      startupImage("1179x2556.png", 393, 852, 3),
      startupImage("1290x2796.png", 430, 932, 3),
    ],
  },
  icons: {
    apple: "/icons/icon-180.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: THEME_COLOR,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      {/* body sem flex/height — receita Melhores Práticas v3 (globals.css) */}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
