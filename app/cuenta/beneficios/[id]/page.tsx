import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cerrarSesion } from "@/app/cuenta/actions";
import { BotonWhatsappBeneficio, RegistrarVista } from "@/components/beneficios/RegistroBeneficio";
import { BarraInferiorCuenta } from "@/components/pantallas/BarraInferiorCuenta";
import { EncabezadoCuenta } from "@/components/pantallas/EncabezadoCuenta";
import { IconoVolver } from "@/components/ui/Iconos";
import { cargarBeneficio, sesionBeneficios } from "@/lib/beneficios/servidor";
import { fechaCorta } from "@/lib/convenio/publicaciones";

export const metadata: Metadata = { title: "Beneficio · Cooperativa Green Alliance" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Detalle de una publicación (docs/spec-convenios.md §B5): imagen o galería,
 * PDF en un visor con descarga de respaldo, y WhatsApp del convenio. Registra
 * la vista al abrir y el clic antes de salir a wa.me.
 */
export default async function BeneficioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, nombre, esAsociado } = await sesionBeneficios();
  const b = esAsociado ? await cargarBeneficio(supabase, id) : null;
  if (!b) notFound();

  const tipoTexto = b.tipo === "promocion" ? "Promoción" : "Catálogo";
  const vigencia =
    b.iniciaEl && b.terminaEl
      ? `Del ${fechaCorta(b.iniciaEl)} al ${fechaCorta(b.terminaEl, true)}`
      : b.terminaEl
        ? `Hasta el ${fechaCorta(b.terminaEl, true)}`
        : null;

  return (
    <div className="min-h-dvh bg-ga-fondo-suave pb-28 lg:pb-0">
      <EncabezadoCuenta nombre={nombre} seccion="beneficios" accionSalir={cerrarSesion} />
      <RegistrarVista id={b.id} />
      <main className="flex flex-col gap-5 px-5 pb-6 pt-5 md:mx-auto md:max-w-2xl lg:max-w-5xl lg:px-10 lg:py-10">
        <Link href="/cuenta/beneficios" className="flex items-center gap-1.5 self-start text-15 font-semibold text-ga-verde no-underline">
          <IconoVolver tamano={18} />
          Beneficios
        </Link>

        <article className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_1fr] lg:items-start lg:gap-8">
          <div className="flex flex-col gap-3">
            {b.pdfUrl ? (
              <>
                <iframe
                  src={b.pdfUrl}
                  title={`Catálogo de ${b.convenioNombre}`}
                  className="hidden h-[70vh] w-full rounded-20 bg-white shadow-[inset_0_0_0_1px_var(--ga-linea)] sm:block"
                />
                <a
                  href={b.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-12.5 items-center justify-center rounded-full bg-ga-verde px-6 text-15 font-semibold text-white no-underline hover:bg-ga-verde-oscuro hover:text-white"
                >
                  Abrir el catálogo (PDF)
                </a>
              </>
            ) : b.imagenesUrl.length > 1 ? (
              <ul
                aria-label={`Imágenes del catálogo (${b.imagenesUrl.length})`}
                className="m-0 flex list-none snap-x snap-mandatory gap-3 overflow-x-auto p-0 pb-1"
              >
                {b.imagenesUrl.map((url, i) => (
                  <li key={url} className="w-[88%] shrink-0 snap-center sm:w-[75%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Imagen ${i + 1} de ${b.imagenesUrl.length}`}
                      className="aspect-[4/3] w-full rounded-20 bg-white object-contain"
                      loading={i === 0 ? "eager" : "lazy"}
                    />
                  </li>
                ))}
              </ul>
            ) : b.portada ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.portada} alt={b.titulo} className="aspect-[4/3] w-full rounded-20 bg-white object-contain" />
            ) : null}
          </div>

          <div className="flex flex-col gap-4 rounded-28 bg-white p-5 lg:p-7">
            <div className="flex items-center gap-3">
              {b.convenioLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={b.convenioLogoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-12 bg-white object-contain p-1 shadow-[inset_0_0_0_1px_var(--ga-linea)]"
                />
              ) : null}
              <div className="flex min-w-0 flex-col">
                <span className="text-13 font-semibold text-ga-verde">{b.especialidad || tipoTexto}</span>
                <span className="truncate text-16 font-semibold text-ga-texto">{b.convenioNombre}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {b.beneficio ? (
                <span className="rounded-full bg-ga-navy px-3 py-1 text-14 font-semibold text-white">{b.beneficio}</span>
              ) : null}
              {b.nuevo ? <span className="rounded-full bg-ga-verde-tint px-2.5 py-0.5 text-13 font-semibold text-ga-verde-oscuro">Nuevo</span> : null}
            </div>
            <h1 className="m-0 font-display text-26 font-semibold leading-snug text-ga-navy lg:text-30">{b.titulo}</h1>
            {b.descripcion ? <p className="m-0 whitespace-pre-line text-16 leading-155 text-ga-texto-2">{b.descripcion}</p> : null}
            <p className="m-0 text-14 text-ga-texto-3">
              {tipoTexto}
              {vigencia ? ` · ${vigencia}` : ""}
            </p>
            {b.whatsappUrl ? (
              <BotonWhatsappBeneficio id={b.id} href={b.whatsappUrl} />
            ) : (
              <p className="m-0 text-14 text-ga-texto-3">Este convenio todavía no tiene WhatsApp registrado.</p>
            )}
          </div>
        </article>
      </main>
      <BarraInferiorCuenta activa={null} />
    </div>
  );
}
