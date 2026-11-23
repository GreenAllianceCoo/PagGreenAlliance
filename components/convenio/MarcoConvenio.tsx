import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cerrarSesionConvenio } from "@/app/convenio/actions";
import { IconoInicio, IconoSalir, IconoTienda } from "@/components/ui/Iconos";
import { cx } from "@/components/ui/cx";

type Seccion = "inicio" | "empresa" | "publicacion";

const NAV = [
  { clave: "inicio", href: "/convenio", etiqueta: "Inicio", Icono: IconoInicio },
  { clave: "empresa", href: "/convenio/empresa", etiqueta: "Mi empresa", Icono: IconoTienda },
] as const;

/**
 * Marco del panel de la empresa en convenio: franja verde de la marca con el
 * logo de la empresa, la navegación en píldoras y un espacio para el saludo o
 * el título (`hero`). El contenido sube sobre la franja (tarjetas blancas),
 * como el inicio de Shopify o el perfil de negocio de Google.
 */
export function MarcoConvenio({
  nombre,
  logoUrl,
  seccion,
  hero,
  children,
}: {
  nombre: string;
  logoUrl: string | null;
  seccion: Seccion;
  hero: ReactNode;
  children: ReactNode;
}) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || "C";
  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      <div className="relative overflow-hidden bg-ga-verde-oscuro text-white">
        <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px] rounded-full bg-ga-verde" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-6 top-10 hidden opacity-[0.12] sm:block">
          <Image src="/logos/blanco/green-alliance-isotipo-blanco.svg" alt="" width={220} height={220} />
        </span>
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-[38%] h-40 w-40 rounded-full bg-ga-menta opacity-20 blur-2xl" />

        <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-24 pt-5 lg:pt-7">
          <header className="flex items-center justify-between gap-3">
            <Link href="/convenio" className="flex min-w-0 items-center gap-3 text-white no-underline">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-14 bg-white object-contain p-1" />
              ) : (
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-14 bg-ga-menta font-display text-22 font-semibold text-ga-verde-oscuro">
                  {inicial}
                </span>
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-13 text-ga-menta-suave">Panel del convenio<span className="hidden sm:inline"> · Green Alliance</span></span>
                <span className="truncate font-display text-20 font-semibold">{nombre}</span>
              </span>
            </Link>
            <form action={cerrarSesionConvenio}>
              <button
                type="submit"
                className="flex h-10 items-center gap-2 rounded-full px-4 text-14 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] hover:bg-white/10"
              >
                <IconoSalir tamano={16} />
                Salir
              </button>
            </form>
          </header>

          <nav aria-label="Secciones del panel" className="flex gap-2">
            {NAV.map(({ clave, href, etiqueta, Icono }) => {
              const activa = seccion === clave || (clave === "inicio" && seccion === "publicacion");
              return (
                <Link
                  key={clave}
                  href={href}
                  aria-current={seccion === clave ? "page" : undefined}
                  className={cx(
                    "flex h-10 items-center gap-2 rounded-full px-4 text-14 font-semibold no-underline transition-colors",
                    activa ? "bg-white text-ga-verde-oscuro" : "text-white/85 hover:bg-white/10",
                  )}
                >
                  <Icono tamano={17} />
                  {etiqueta}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-5">{hero}</div>
        </div>
      </div>

      <main className="relative mx-auto -mt-16 flex w-full max-w-5xl flex-col gap-6 px-4 pb-14">{children}</main>
    </div>
  );
}
