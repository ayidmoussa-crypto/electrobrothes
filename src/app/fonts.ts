import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

// Variable font: one file covers every weight (400–800) instead of five.
export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Plex Arabic tops out at 700; Arabic headings render at 700 where Inter uses 800.
export const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const fontClasses = `${inter.variable} ${plexArabic.variable}`;
