import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoConvenio } from "@/components/convenio/EncabezadoConvenio";
import { FormularioPublicacion } from "@/components/convenio/FormularioPublicacion";
import { IconoVolver } from "@/components/ui/Iconos";
import { activasPorTipo, hoyBogota, NOMBRE_TIPO, TOPE_POR_TIPO, type TipoPublicacion } from "@/lib/convenio/publicaciones";
import { exigirConvenio, listarPublicacionesPropias } from "@/lib/convenio/servidor";

export const metadata: Metadata = { title: "Nueva publicación · Panel del convenio · Green Alliance" };

/** Nueva promoción o nuevo catálogo (/convenio/nueva?tipo=promocion|catalogo). */
export default async function NuevaPublicacionPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { supabase, convenio } = await exigirConvenio();
  const { tipo: tipoParam } = await searchParams;
  if (tipoParam !== "promocion" && tipoParam !== "catalogo") redirect("/convenio");
  const tipo: TipoPublicacion = tipoParam;

  const hoy = hoyBogota();
  const { publicaciones } = await listarPublicacionesPropias(supabase);
  const lleno = activasPorTipo(publicaciones, hoy)[tipo] >= TOPE_POR_TIPO[tipo];

  return (
    <main className="min-h-dvh bg-ga-fondo-suave">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 lg:py-10">
        <EncabezadoConvenio nombre={convenio.nombre} logoUrl={convenio.logoUrl} />
        <div className="flex flex-col gap-1">
          <Link href="/convenio" className="enlace flex items-center gap-1 self-start text-15 font-semibold">
            <IconoVolver tamano={18} /> Tus publicaciones
          </Link>
          <h1 className="m-0 font-display text-26 font-semibold text-ga-navy">{NOMBRE_TIPO[tipo].nuevo}</h1>
        </div>
        {lleno ? (
          <p className="m-0 rounded-20 bg-ga-superficie p-6 text-15 text-ga-texto-2 shadow-[inset_0_0_0_1px_var(--ga-linea)]">
            Ya tienes {TOPE_POR_TIPO[tipo]} {NOMBRE_TIPO[tipo].varios} activas o programadas, el máximo. Retira una o espera a que
            alguna venza.
          </p>
        ) : (
          <FormularioPublicacion
            modo="nueva"
            tipo={tipo}
            publicacionId={crypto.randomUUID()}
            convenio={{ nombre: convenio.nombre, logoUrl: convenio.logoUrl }}
            hoy={hoy}
          />
        )}
      </div>
    </main>
  );
}
