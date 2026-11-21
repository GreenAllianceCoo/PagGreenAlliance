import type { Metadata } from "next";
import { exigirConvenio } from "@/lib/convenio/servidor";
import { cerrarSesionConvenio } from "./actions";

export const metadata: Metadata = { title: "Panel del convenio · Green Alliance" };

/**
 * Inicio del panel del convenio. B2 solo deja la entrada lista; las
 * publicaciones (promociones y catálogos) llegan en B3 (docs/spec-convenios.md).
 */
export default async function ConvenioPage() {
  const { convenio } = await exigirConvenio();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {convenio.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={convenio.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-12 bg-white object-contain p-1" />
          ) : null}
          <div className="flex min-w-0 flex-col">
            <span className="text-14 text-ga-texto-3">Panel del convenio</span>
            <h1 className="m-0 truncate font-display text-24 font-semibold text-ga-navy">{convenio.nombre}</h1>
          </div>
        </div>
        <form action={cerrarSesionConvenio}>
          <button type="submit" className="enlace text-15 font-bold">
            Salir
          </button>
        </form>
      </header>
      <section className="flex flex-col gap-2 rounded-20 bg-white p-6 shadow-[inset_0_0_0_1px_var(--ga-linea)]">
        <h2 className="m-0 font-display text-20 font-semibold text-ga-navy">Tu acceso está listo</h2>
        <p className="m-0 text-16 leading-150 text-ga-texto-2">
          Muy pronto podrás publicar aquí tus promociones y catálogos para los asociados de Green Alliance.
        </p>
      </section>
    </main>
  );
}
