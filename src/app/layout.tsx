import type { Metadata } from "next";
import { Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Manrope: 700 for headlines, 400/500 for body — docs/DESIGN.md §4.
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// IBM Plex Mono: metadata, timestamps, technical/archive labels only — never long paragraphs.
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "LayoffHedge Attention Index — Independent Public Record",
  description:
    "An independent, open-source record of LayoffHedge's public reach, viral posts, media references, and real-world amplification.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
