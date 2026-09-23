import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos · Cooperativa Green Alliance",
};

/**
 * Placeholder de /politica-de-datos (mapa de botones §5: «página placeholder
 * hasta tener el texto»). No hay diseño: reutiliza el encabezado y los tamaños
 * de texto de /afiliacion. Revisar con ga-diseno-a-codigo.
 * TODO(pendiente-spec): texto de la política de tratamiento de datos (Ley 1581 de 2012).
 */
export default function PoliticaDeDatosPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex items-center justify-between border-b border-ga-linea px-6 pb-5 pt-6 lg:h-19 lg:px-14 lg:py-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo">
          <Logo tone="dark" />
        </Link>
      </header>
      <main className="flex flex-col gap-4 px-6 py-6 md:mx-auto md:max-w-2xl lg:py-12">
        <h1 className="m-0 text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110">
          Política de tratamiento de datos
        </h1>
        <p className="m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
          [Texto de la política de tratamiento de datos personales de la Cooperativa Green Alliance,
          según la Ley 1581 de 2012 — pendiente de la cooperativa.]
        </p>
      </main>
    </div>
  );
}
