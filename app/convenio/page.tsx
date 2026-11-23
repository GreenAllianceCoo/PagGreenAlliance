import type { Metadata } from "next";
import Link from "next/link";
import { LineaEstadoPublicacion } from "@/components/convenio/LineaEstadoPublicacion";
import { MarcoConvenio } from "@/components/convenio/MarcoConvenio";
import { IconoCheck, IconoDocumento, IconoLibro, IconoMas, IconoMegafono, IconoOjo, IconoWhatsapp } from "@/components/ui/Iconos";
import { cx } from "@/components/ui/cx";
import {
  activasPorTipo,
  estadoPublicacion,
  hoyBogota,
  NOMBRE_TIPO,
  TOPE_POR_TIPO,
  type EstadoPublicacion,
  type TipoPublicacion,
} from "@/lib/convenio/publicaciones";
import { exigirConvenio, listarPublicacionesPropias, obtenerFichaPropia, pasosFicha } from "@/lib/convenio/servidor";

export const metadata: Metadata = { title: "Panel del convenio · Green Alliance" };

const AVISOS: Record<string, string> = {
  publicada: "Listo, tu publicación ya está en Beneficios.",
  editada: "Guardamos los cambios.",
  retirada: "Retiramos la publicación.",
  empresa: "Guardamos los datos de tu empresa. Los asociados ya ven la ficha nueva.",
};

/** Color de cada tipo: promociones en verde menta, catálogos en ámbar. */
const TONO_TIPO: Record<TipoPublicacion, { fondo: string; icono: string; barra: string; Icono: typeof IconoMegafono }> = {
  promocion: { fondo: "bg-ga-verde-tint", icono: "bg-ga-verde text-white", barra: "bg-ga-verde", Icono: IconoMegafono },
  catalogo: { fondo: "bg-ga-ambar-fondo-suave", icono: "bg-ga-ambar text-ga-ambar-texto-2", barra: "bg-ga-ambar", Icono: IconoLibro },
};

const CHIP_ESTADO: Record<EstadoPublicacion, { texto: string; clase: string }> = {
  publicada: { texto: "Publicada", clase: "bg-ga-verde-tint text-ga-verde-oscuro" },
  programada: { texto: "Programada", clase: "bg-ga-ambar-fondo text-ga-ambar-texto" },
  vencida: { texto: "Vencida", clase: "bg-ga-fondo-suave text-ga-texto-2" },
  oculta: { texto: "Oculta", clase: "bg-ga-error-fondo text-ga-error-texto" },
};

function numero(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

function saludo() {
  const hora = Number(new Intl.DateTimeFormat("es-CO", { hour: "numeric", hourCycle: "h23", timeZone: "America/Bogota" }).format(new Date()));
  return hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
}

/** Inicio del panel del convenio (docs/spec-convenios.md §B3). */
export default async function ConvenioPage({ searchParams }: { searchParams: Promise<{ listo?: string }> }) {
  const { supabase, convenio } = await exigirConvenio();
  const [{ listo }, { publicaciones, error }, ficha] = await Promise.all([
    searchParams,
    listarPublicacionesPropias(supabase),
    obtenerFichaPropia(supabase, convenio.id),
  ]);
  const hoy = hoyBogota();
  const activas = activasPorTipo(publicaciones, hoy);
  const aviso = listo ? AVISOS[listo] : undefined;
  const totales = publicaciones.reduce(
    (t, p) => ({ vistas: t.vistas + p.metricas.vistas, asociados: t.asociados + p.metricas.vistasUnicas, clics: t.clics + p.metricas.clics }),
    { vistas: 0, asociados: 0, clics: 0 },
  );
  const enLinea = publicaciones.filter((p) => estadoPublicacion(p, hoy) === "publicada").length;
  const pasos = ficha ? pasosFicha(ficha) : [];
  const hechos = pasos.filter((p) => p.listo).length;

  const cifras = [
    { etiqueta: "Publicaciones en línea", valor: numero(enLinea), Icono: IconoMegafono },
    { etiqueta: "Vistas de asociados", valor: numero(totales.vistas), nota: `${numero(totales.asociados)} asociados`, Icono: IconoOjo },
    { etiqueta: "Clics en WhatsApp", valor: numero(totales.clics), Icono: IconoWhatsapp },
  ];

  return (
    <MarcoConvenio
      nombre={convenio.nombre}
      logoUrl={convenio.logoUrl}
      seccion="inicio"
      hero={
        <>
          <div className="flex flex-col gap-1">
            <h1 className="m-0 font-display text-30 font-semibold leading-tight lg:text-34">{saludo()}</h1>
            <p className="m-0 max-w-xl text-16 leading-150 text-ga-menta-suave">
              Esto es lo que ven los asociados de Green Alliance de tu empresa.
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:gap-3">
            {cifras.map(({ etiqueta, valor, nota, Icono }) => (
              <li key={etiqueta} className="flex flex-col gap-2 rounded-20 bg-white/10 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] sm:flex-row sm:items-center sm:gap-3.5 sm:p-4">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ga-menta text-ga-verde-oscuro sm:h-11 sm:w-11">
                  <Icono tamano={18} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-24 font-semibold leading-none sm:text-28">{valor}</span>
                  <span className="text-13 leading-tight text-ga-menta-suave sm:text-14">
                    {etiqueta}
                    {nota ? <span className="hidden sm:inline"> · {nota}</span> : null}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </>
      }
    >
      {aviso ? (
        <p role="status" className="m-0 flex items-center gap-3 rounded-16 bg-white px-4 py-3.5 text-15 font-semibold text-ga-verde-oscuro shadow-[0_8px_24px_-12px_rgba(20,73,58,0.35)]">
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ga-verde text-white">
            <IconoCheck tamano={16} grosor={2.6} />
          </span>
          {aviso}
        </p>
      ) : null}

      {ficha && hechos < pasos.length ? (
        <section aria-labelledby="titulo-perfil" className="flex flex-col gap-4 rounded-24 bg-white p-5 shadow-[0_8px_24px_-14px_rgba(20,73,58,0.3)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="titulo-perfil" className="m-0 font-display text-20 font-semibold text-ga-navy">
                Completa la ficha de tu empresa
              </h2>
              <p className="m-0 text-14 text-ga-texto-2">Una ficha completa da más confianza y recibe más mensajes.</p>
            </div>
            <span className="rounded-full bg-ga-ambar-fondo px-3 py-1 text-14 font-semibold text-ga-ambar-texto">
              {hechos} de {pasos.length} listos
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ga-ambar-fondo" aria-hidden="true">
            <div className="h-full rounded-full bg-ga-ambar" style={{ width: `${(hechos / pasos.length) * 100}%` }} />
          </div>
          <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {pasos.map((p) => (
              <li key={p.clave}>
                <Link
                  href={`/convenio/empresa#campo-${p.clave}`}
                  className={cx(
                    "flex h-full items-center gap-2.5 rounded-14 px-3 py-2.5 text-15 no-underline",
                    p.listo ? "text-ga-texto-3 line-through" : "bg-ga-fondo-suave font-semibold text-ga-texto hover:bg-ga-verde-tint",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      p.listo ? "bg-ga-verde text-white" : "border-2 border-dashed border-ga-ambar",
                    )}
                  >
                    {p.listo ? <IconoCheck tamano={14} grosor={2.8} /> : null}
                  </span>
                  {p.etiqueta}
                  <span className="sr-only">{p.listo ? " (listo)" : " (pendiente)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-label="Publicar" className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["promocion", "catalogo"] as TipoPublicacion[]).map((tipo) => {
            const lleno = activas[tipo] >= TOPE_POR_TIPO[tipo];
            const tono = TONO_TIPO[tipo];
            const contenido = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className={cx("flex h-12 w-12 items-center justify-center rounded-16", tono.icono)}>
                    <tono.Icono tamano={24} />
                  </span>
                  <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-13 font-semibold text-ga-texto-2">
                    {activas[tipo]} de {TOPE_POR_TIPO[tipo]} activas
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-display text-20 font-semibold capitalize text-ga-navy">{NOMBRE_TIPO[tipo].varios}</span>
                  <span className="text-14 leading-150 text-ga-texto-2">
                    {lleno
                      ? "Llegaste al máximo. Retira una o espera a que alguna venza."
                      : tipo === "promocion"
                        ? "Un descuento o beneficio con fecha de inicio y fin."
                        : "Tus productos o servicios en imágenes o en un PDF."}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white" aria-hidden="true">
                  <div className={cx("h-full rounded-full", tono.barra)} style={{ width: `${(activas[tipo] / TOPE_POR_TIPO[tipo]) * 100}%` }} />
                </div>
                {lleno ? null : (
                  <span className="flex items-center gap-1.5 text-15 font-semibold text-ga-verde-oscuro">
                    <IconoMas tamano={18} />
                    {NOMBRE_TIPO[tipo].nuevo}
                  </span>
                )}
              </>
            );
            const clases = cx("flex flex-col gap-4 rounded-24 p-5 text-inherit no-underline sm:p-6", tono.fondo);
            return lleno ? (
              <div key={tipo} className={clases}>
                {contenido}
              </div>
            ) : (
              <Link
                key={tipo}
                href={`/convenio/nueva?tipo=${tipo}`}
                className={cx(clases, "transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-16px_rgba(20,73,58,0.45)]")}
              >
                {contenido}
              </Link>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="titulo-publicaciones" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="titulo-publicaciones" className="m-0 font-display text-24 font-semibold text-ga-navy">
            Tus publicaciones
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            Aparecen al instante en Beneficios, la sección que ven los asociados con sesión.
          </p>
        </div>

        {error ? (
          <p role="alert" className="m-0 text-15 font-semibold text-ga-error-texto">
            No pudimos cargar tus publicaciones. Recarga la página.
          </p>
        ) : publicaciones.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-24 border-2 border-dashed border-ga-verde-borde-pendiente bg-white px-6 py-10 text-center">
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde">
              <IconoMegafono tamano={26} />
            </span>
            <p className="m-0 font-display text-18 font-semibold text-ga-navy">Todavía no tienes publicaciones</p>
            <p className="m-0 max-w-sm text-15 text-ga-texto-2">Empieza con una promoción: es lo que más miran los asociados.</p>
            <Link href="/convenio/nueva?tipo=promocion" className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-ga-verde px-5 text-15 font-semibold text-white no-underline hover:bg-ga-verde-oscuro">
              <IconoMas tamano={18} /> Nueva promoción
            </Link>
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 lg:grid-cols-2">
            {publicaciones.map((p) => {
              const estado = estadoPublicacion(p, hoy);
              const tono = TONO_TIPO[p.tipo];
              const chip = CHIP_ESTADO[estado];
              return (
                <li key={p.id}>
                  <Link
                    href={`/convenio/${p.id}`}
                    className="flex h-full flex-col gap-3 rounded-24 bg-white p-3.5 text-inherit no-underline shadow-[0_6px_20px_-14px_rgba(20,73,58,0.35)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--ga-verde),0_10px_24px_-14px_rgba(20,73,58,0.45)] sm:p-4"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className={cx("flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-16 sm:h-20 sm:w-20", tono.fondo)}>
                        {p.portada ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.portada} alt="" className="h-full w-full object-cover" />
                        ) : p.tipo === "catalogo" && p.pdfPath ? (
                          <IconoDocumento tamano={28} grosor={1.6} className="text-ga-ambar-texto" />
                        ) : (
                          <tono.Icono tamano={28} className="text-ga-verde" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cx("rounded-full px-2.5 py-0.5 text-12 font-semibold", chip.clase)}>{chip.texto}</span>
                          <span className="text-13 text-ga-texto-3">
                            {p.tipo === "promocion" ? "Promoción" : p.pdfPath ? "Catálogo en PDF" : "Catálogo"}
                            {p.beneficio ? ` · ${p.beneficio}` : ""}
                          </span>
                        </div>
                        <span className="line-clamp-2 text-16 font-semibold text-ga-texto">{p.titulo}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2.5 border-t border-ga-linea-suave pt-3">
                      <LineaEstadoPublicacion estado={estado} iniciaEl={p.iniciaEl} terminaEl={p.terminaEl} motivo={p.ocultaMotivo} />
                      <div className="flex flex-wrap gap-2 text-13 font-semibold">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ga-fondo-suave px-2.5 py-1 text-ga-navy">
                          <IconoOjo tamano={15} />
                          {numero(p.metricas.vistas)} {p.metricas.vistas === 1 ? "vista" : "vistas"} · {numero(p.metricas.vistasUnicas)}{" "}
                          {p.metricas.vistasUnicas === 1 ? "asociado" : "asociados"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ga-verde-tint px-2.5 py-1 text-ga-verde-oscuro">
                          <IconoWhatsapp tamano={15} />
                          {numero(p.metricas.clics)} {p.metricas.clics === 1 ? "clic" : "clics"}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </MarcoConvenio>
  );
}
