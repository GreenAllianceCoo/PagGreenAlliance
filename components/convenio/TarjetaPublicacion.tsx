import { IconoDocumento } from "@/components/ui/Iconos";
import { fechaCorta, type TipoPublicacion } from "@/lib/convenio/publicaciones";

export type DatosTarjetaPublicacion = {
  tipo: TipoPublicacion;
  titulo: string;
  descripcion: string | null;
  beneficio: string | null;
  terminaEl: string | null;
  /** URL de la primera imagen (firmada o local en la vista previa). */
  portada: string | null;
  /** Cuántas imágenes tiene (catálogo en imágenes). */
  totalImagenes: number;
  esPdf: boolean;
  convenio: { nombre: string; logoUrl: string | null };
  /** Etiqueta «Nuevo» (publicada en los últimos 7 días). */
  nuevo?: boolean;
};

/**
 * Publicación tal como la ve el asociado en Beneficios. Sirve también de
 * vista previa en el formulario del convenio. Solo presentación.
 */
export function TarjetaPublicacion({ datos }: { datos: DatosTarjetaPublicacion }) {
  const { tipo, titulo, descripcion, beneficio, terminaEl, portada, totalImagenes, esPdf, convenio, nuevo } = datos;
  return (
    <article className="flex flex-col overflow-hidden rounded-20 bg-ga-superficie shadow-[inset_0_0_0_1px_var(--ga-linea)]">
      <div className="relative aspect-[4/3] w-full bg-ga-fondo-suave">
        {portada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portada} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ga-texto-3">
            <IconoDocumento tamano={36} grosor={1.6} />
            <span className="text-14">{esPdf ? "Catálogo en PDF" : "Sin imagen todavía"}</span>
          </div>
        )}
        {beneficio ? (
          <span className="absolute left-3 top-3 rounded-full bg-ga-navy px-3 py-1 text-14 font-semibold text-white">{beneficio}</span>
        ) : null}
        {nuevo ? (
          <span className="absolute right-3 top-3 rounded-full bg-white px-2.5 py-0.5 text-13 font-semibold text-ga-verde">Nuevo</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-13 text-ga-texto-2">
          {convenio.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={convenio.logoUrl} alt="" className="h-6 w-6 shrink-0 rounded-6 bg-white object-contain" />
          ) : null}
          <span className="truncate">{convenio.nombre}</span>
        </div>
        <h3 className="m-0 font-display text-18 font-semibold leading-snug text-ga-navy">{titulo || "Título de la publicación"}</h3>
        {descripcion ? <p className="m-0 line-clamp-3 text-15 leading-150 text-ga-texto-2">{descripcion}</p> : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-13 text-ga-texto-3">
          <span>{tipo === "promocion" ? "Promoción" : esPdf ? "Catálogo · PDF" : `Catálogo · ${totalImagenes} ${totalImagenes === 1 ? "imagen" : "imágenes"}`}</span>
          {terminaEl ? <span>Hasta el {fechaCorta(terminaEl)}</span> : null}
        </div>
      </div>
    </article>
  );
}
