import type { Metadata } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./globals.css";

// Manrope (400/600/700/800) para todo el texto.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Rediseño C+ (25-sep-2026): Bricolage Grotesque (600/800) para títulos y
// cifras grandes (docs/Green Alliance C+.dc.html). Se usa con la clase
// utilitaria `font-display` (tailwind.config.ts); el resto del texto sigue
// en Manrope.
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "800"],
  variable: "--font-bricolage",
  display: "swap",
});

// El texto del logo ya no usa Montserrat: se dibuja con las letras del SVG oficial
// (components/ui/Logo.tsx), así que no se descarga esa fuente.

export const metadata: Metadata = {
  title: "Cooperativa Green Alliance",
  description: "Plataforma de gestion de creditos para asociados",
  icons: {
    icon: "/logos/vector/favicon-32.png",
    apple: "/logos/vector/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${manrope.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
