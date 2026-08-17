import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import AmbientGlobe from "@/components/globe/AmbientGlobe";

export const metadata: Metadata = {
  title: "ResilienceMap AI — Disaster Risk Intelligence",
  description:
    "Immersive AI-powered disaster risk intelligence: interactive hazard maps, executive dashboards, grounded AI insights, and exportable reports.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="antialiased">
        <div className="app-backdrop" aria-hidden="true" />
        <AmbientGlobe />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
