import type { Metadata } from "next";
import { Manrope, Montserrat } from "next/font/google";
import "./globals.css";

// Manrope (400/600/700/800) para todo el texto.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

// Montserrat solo para el texto del logo (700 en «COOPERATIVA», 800 en «GREEN ALLIANCE»).
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

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
    <html lang="es" className={`${manrope.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
