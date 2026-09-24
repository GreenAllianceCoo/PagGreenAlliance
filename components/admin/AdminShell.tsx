import type { ReactNode } from "react";
import { EncabezadoAdmin } from "./EncabezadoAdmin";

type AdminShellProps = {
  nombre: string;
  seccion: "afiliaciones" | "creditos" | "asesores" | "sorteo";
  children: ReactNode;
};

/** Fondo, encabezado y ancho del contenido, iguales en las 4 secciones de /admin. */
export function AdminShell({ nombre, seccion, children }: AdminShellProps) {
  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      <EncabezadoAdmin nombre={nombre} seccion={seccion} />
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-6 lg:gap-6 lg:px-14 lg:py-10">{children}</main>
    </div>
  );
}
