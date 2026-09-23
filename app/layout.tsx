import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

// Manrope (400/600/700/800) para todo el texto.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-manrope",
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
    <html lang="es" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
