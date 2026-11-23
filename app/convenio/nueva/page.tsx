import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarcoConvenio } from "@/components/convenio/MarcoConvenio";
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
    <MarcoConvenio
      nombre={convenio.nombre}
      logoUrl={convenio.logoUrl}
      seccion="publicacion"
      hero={
        <div className="flex flex-col gap-2">
          <Link href="/convenio" className="flex items-center gap-1 self-start text-15 font-semibold text-ga-menta-suave no-underline hover:text-white">
            <IconoVolver tamano={18} /> Volver al inicio
          </Link>
          <h1 className="m-0 font-display text-30 font-semibold leading-tight lg:text-34">{NOMBRE_TIPO[tipo].nuevo}</h1>
          <p className="m-0 max-w-xl text-16 leading-150 text-ga-menta-suave">
            {tipo === "promocion"
              ? "Cuenta el beneficio en pocas palabras y agrega una imagen llamativa."
              : "Sube tus productos o servicios en imágenes o en un PDF."}
          </p>
        </div>
      }
    >
      <div className="rounded-24 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(20,73,58,0.35)] sm:p-6">
        {lleno ? (
          <p className="m-0 text-15 text-ga-texto-2">
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
    </MarcoConvenio>
  );
}
