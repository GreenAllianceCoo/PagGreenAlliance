import Link from "next/link";
import { cerrarSesionConvenio } from "@/app/convenio/actions";

/** Encabezado del panel del convenio: logo, nombre y «Salir». */
export function EncabezadoConvenio({ nombre, logoUrl }: { nombre: string; logoUrl: string | null }) {
  return (
    <header className="flex items-center justify-between gap-4">
      <Link href="/convenio" className="flex min-w-0 items-center gap-3 no-underline">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-12 bg-white object-contain p-1 shadow-[inset_0_0_0_1px_var(--ga-linea)]" />
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className="text-13 text-ga-texto-3">Panel del convenio</span>
          <span className="truncate font-display text-20 font-semibold text-ga-navy">{nombre}</span>
        </span>
      </Link>
      <form action={cerrarSesionConvenio}>
        <button type="submit" className="enlace text-15 font-semibold">
          Salir
        </button>
      </form>
    </header>
  );
}
