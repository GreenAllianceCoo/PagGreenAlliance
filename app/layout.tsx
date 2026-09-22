import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cooperativa Green Alliance",
  description: "Plataforma de gestion de creditos para asociados",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
