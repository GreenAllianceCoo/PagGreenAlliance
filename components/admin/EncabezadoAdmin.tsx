import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cerrarSesion } from "@/app/cuenta/actions";

const PESTANAS = [
  { href: "/admin/afiliaciones", etiqueta: "Afiliaciones" },
  { href: "/admin/creditos", etiqueta: "Créditos" },
  { href: "/admin/asesores", etiqueta: "Asesores" },
  { href: "/admin/sorteo", etiqueta: "Sorteo" },
] as const;

const CLASE_ACTIVA = "border-b-2 border-ga-verde pb-1 text-ga-verde no-underline";
const CLASE_INACTIVA = "text-ga-texto no-underline hover:text-ga-verde";

type EncabezadoAdminProps = {
  nombre: string;
  /** Sección actual, para subrayarla (coincide con el primer tramo de la ruta). */
  seccion: "afiliaciones" | "creditos" | "asesores" | "sorteo";
};

/**
 * Encabezado propio de /admin: logo, pestañas de las 4 secciones y «Salir»
 * (mismo `signOut` que /cuenta → /ingresar). Coherente con EncabezadoCuenta:
 * mismos tokens, mismas clases de pestaña activa/inactiva.
 */
export function EncabezadoAdmin({ nombre, seccion }: EncabezadoAdminProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-ga-linea bg-white px-5 py-4 lg:h-19 lg:flex-row lg:items-center lg:justify-between lg:px-14 lg:py-0">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin" aria-label="Ir al panel de administración" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="dark" />
        </Link>
        <span className="text-13 font-bold text-ga-texto-3 lg:hidden">Panel de administración</span>
      </div>

      <nav aria-label="Secciones del panel" className="flex flex-wrap gap-5 text-15 font-bold lg:gap-7 lg:text-16">
        {PESTANAS.map((pestana) => {
          const activa = seccion === pestana.href.split("/")[2];
          return (
            <Link
              key={pestana.href}
              href={pestana.href}
              aria-current={activa ? "page" : undefined}
              className={activa ? CLASE_ACTIVA : CLASE_INACTIVA}
            >
              {pestana.etiqueta}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between gap-3.5 text-15 lg:justify-end">
        <span className="max-w-[200px] truncate font-bold">{nombre}</span>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-10 border-1.5 border-ga-borde px-3.5 font-bold text-ga-navy hover:bg-ga-fondo-suave"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
