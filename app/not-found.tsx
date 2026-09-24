import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Página no encontrada · Cooperativa Green Alliance",
};

/**
 * Página 404 en español (F-04, verificación del 2026-09-23): Next.js sirve por
 * defecto una 404 en inglés sin marca. Reutiliza el encabezado y los tamaños de
 * texto de /politica-de-datos; no hay maqueta de esta pantalla.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ga-linea px-6 pb-5 pt-6 lg:h-19 lg:px-14 lg:py-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="dark" />
        </Link>
      </header>
      <main className="flex grow flex-col items-center justify-center gap-4 px-6 py-14 text-center md:mx-auto md:max-w-2xl lg:py-24">
        <Logo variant="apilado" className="w-[140px] lg:w-[160px]" />
        <p className="m-0 text-15 font-extrabold uppercase tracking-widest text-ga-verde">Error 404</p>
        <h1 className="m-0 text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110">
          No encontramos esta página
        </h1>
        <p className="m-0 max-w-prose text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
          Puede que el enlace esté vencido o que hayas escrito mal la dirección. Vuelve al inicio para
          seguir navegando.
        </p>
        <ButtonLink href="/" className="mt-2 lg:inline-flex lg:px-9">
          Volver al inicio
        </ButtonLink>
      </main>
    </div>
  );
}
