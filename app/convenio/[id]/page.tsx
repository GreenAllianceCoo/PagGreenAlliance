import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BotonRetirar } from "@/components/convenio/BotonRetirar";
import { MarcoConvenio } from "@/components/convenio/MarcoConvenio";
import { FormularioPublicacion } from "@/components/convenio/FormularioPublicacion";
import { LineaEstadoPublicacion } from "@/components/convenio/LineaEstadoPublicacion";
import { IconoVolver } from "@/components/ui/Iconos";
import { estadoPublicacion, hoyBogota, NOMBRE_TIPO } from "@/lib/convenio/publicaciones";
import { exigirConvenio, obtenerPublicacionPropia, urlsFirmadas } from "@/lib/convenio/servidor";

export const metadata: Metadata = { title: "Publicación · Panel del convenio · Green Alliance" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Editar o retirar una publicación propia. Una oculta por Green Alliance solo se ve. */
export default async function PublicacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, convenio } = await exigirConvenio();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const publicacion = await obtenerPublicacionPropia(supabase, id);
  if (!publicacion) notFound();

  const hoy = hoyBogota();
  const estado = estadoPublicacion(publicacion, hoy);
  const urls = await urlsFirmadas(supabase, publicacion.imagenes);

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
          <h1 className="m-0 font-display text-30 font-semibold leading-tight lg:text-34">
            {estado === "oculta" ? publicacion.titulo : `Editar ${NOMBRE_TIPO[publicacion.tipo].uno}`}
          </h1>
        </div>
      }
    >
      <div className="flex flex-col gap-6 rounded-24 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(20,73,58,0.35)] sm:p-6">
        <div className="max-w-md">
          <LineaEstadoPublicacion
            estado={estado}
            iniciaEl={publicacion.iniciaEl}
            terminaEl={publicacion.terminaEl}
            motivo={publicacion.ocultaMotivo}
          />
        </div>
        {estado === "oculta" ? (
          <p className="m-0 max-w-xl text-15 leading-150 text-ga-texto-2">
            Green Alliance ocultó esta publicación y los asociados ya no la ven. No puedes editarla ni volver a mostrarla; si
            crees que es un error, escríbenos por WhatsApp.
          </p>
        ) : (
          <>
            <FormularioPublicacion
              modo="editar"
              tipo={publicacion.tipo}
              publicacionId={publicacion.id}
              convenio={{ nombre: convenio.nombre, logoUrl: convenio.logoUrl }}
              hoy={hoy}
              inicial={{
                titulo: publicacion.titulo,
                descripcion: publicacion.descripcion ?? "",
                beneficio: publicacion.beneficio ?? "",
                iniciaEl: publicacion.iniciaEl ?? "",
                terminaEl: publicacion.terminaEl ?? "",
                imagenes: publicacion.imagenes.map((ruta) => ({ ruta, url: urls[ruta] ?? null })),
                pdf: publicacion.pdfPath ? { ruta: publicacion.pdfPath } : null,
              }}
            />
            <BotonRetirar id={publicacion.id} />
          </>
        )}
      </div>
    </MarcoConvenio>
  );
}
