import type { Metadata } from "next";
import Link from "next/link";
import { EncabezadoConvenio } from "@/components/convenio/EncabezadoConvenio";
import { LineaEstadoPublicacion } from "@/components/convenio/LineaEstadoPublicacion";
import { clasesBoton } from "@/components/ui/Button";
import { IconoDocumento, IconoMas } from "@/components/ui/Iconos";
import { cx } from "@/components/ui/cx";
import {
  activasPorTipo,
  estadoPublicacion,
  hoyBogota,
  NOMBRE_TIPO,
  TOPE_POR_TIPO,
  type TipoPublicacion,
} from "@/lib/convenio/publicaciones";
import { exigirConvenio, listarPublicacionesPropias } from "@/lib/convenio/servidor";

export const metadata: Metadata = { title: "Panel del convenio · Green Alliance" };

const AVISOS: Record<string, string> = {
  publicada: "Listo, tu publicación ya está en Beneficios.",
  editada: "Guardamos los cambios.",
  retirada: "Retiramos la publicación.",
};

function numero(n: number) {
  return new Intl.NumberFormat("es-CO").format(n);
}

/** Inicio del panel del convenio (docs/spec-convenios.md §B3). */
export default async function ConvenioPage({ searchParams }: { searchParams: Promise<{ listo?: string }> }) {
  const { supabase, convenio } = await exigirConvenio();
  const [{ listo }, { publicaciones, error }] = await Promise.all([searchParams, listarPublicacionesPropias(supabase)]);
  const hoy = hoyBogota();
  const activas = activasPorTipo(publicaciones, hoy);
  const aviso = listo ? AVISOS[listo] : undefined;

  return (
    <main className="min-h-dvh bg-ga-fondo-suave">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 lg:py-10">
        <EncabezadoConvenio nombre={convenio.nombre} logoUrl={convenio.logoUrl} />

        {aviso ? (
          <p role="status" className="m-0 rounded-12 bg-ga-verde-tint px-4 py-3 text-15 font-semibold text-ga-verde-oscuro">
            {aviso}
          </p>
        ) : null}

        <section aria-labelledby="titulo-publicar" className="flex flex-col gap-3">
          <h1 id="titulo-publicar" className="m-0 font-display text-26 font-semibold text-ga-navy">
            Tus publicaciones
          </h1>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            Lo que publiques aparece al instante en Beneficios, la sección que ven los asociados con sesión.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["promocion", "catalogo"] as TipoPublicacion[]).map((tipo) => {
              const lleno = activas[tipo] >= TOPE_POR_TIPO[tipo];
              return (
                <div key={tipo} className="flex flex-col gap-3 rounded-20 bg-ga-superficie p-4 shadow-[inset_0_0_0_1px_var(--ga-linea)]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-16 font-semibold capitalize text-ga-texto">{NOMBRE_TIPO[tipo].varios}</span>
                    <span className="text-14 text-ga-texto-2">
                      {activas[tipo]} de {TOPE_POR_TIPO[tipo]}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-ga-linea" aria-hidden="true">
                    <div className="h-full rounded-full bg-ga-verde" style={{ width: `${(activas[tipo] / TOPE_POR_TIPO[tipo]) * 100}%` }} />
                  </div>
                  {lleno ? (
                    <p className="m-0 text-14 text-ga-texto-2">
                      Llegaste al máximo. Retira una o espera a que alguna venza.
                    </p>
                  ) : (
                    <Link href={`/convenio/nueva?tipo=${tipo}`} className={cx(clasesBoton("secundario"), "gap-2")}>
                      <IconoMas tamano={18} />
                      {NOMBRE_TIPO[tipo].nuevo}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {error ? (
          <p role="alert" className="m-0 text-15 font-semibold text-ga-error-texto">
            No pudimos cargar tus publicaciones. Recarga la página.
          </p>
        ) : publicaciones.length === 0 ? (
          <p className="m-0 rounded-20 bg-ga-superficie p-6 text-center text-15 text-ga-texto-2 shadow-[inset_0_0_0_1px_var(--ga-linea)]">
            Todavía no tienes publicaciones. Empieza con una promoción.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {publicaciones.map((p) => {
              const estado = estadoPublicacion(p, hoy);
              return (
                <li key={p.id}>
                  <Link
                    href={`/convenio/${p.id}`}
                    className="flex flex-col gap-3 rounded-20 bg-ga-superficie p-3 text-inherit no-underline shadow-[inset_0_0_0_1px_var(--ga-linea)] transition-shadow hover:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] sm:p-4"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-14 bg-ga-fondo-suave text-ga-texto-3 sm:h-20 sm:w-20">
                        {p.portada ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.portada} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <IconoDocumento tamano={26} grosor={1.6} />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-13 text-ga-texto-3">
                          {p.tipo === "promocion" ? "Promoción" : p.pdfPath ? "Catálogo en PDF" : "Catálogo"}
                          {p.beneficio ? ` · ${p.beneficio}` : ""}
                        </span>
                        <span className="line-clamp-2 text-16 font-semibold text-ga-texto">{p.titulo}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 border-t border-ga-linea-suave pt-3">
                      <LineaEstadoPublicacion estado={estado} iniciaEl={p.iniciaEl} terminaEl={p.terminaEl} motivo={p.ocultaMotivo} />
                      <span className="text-13 text-ga-texto-2">
                        {numero(p.metricas.vistas)} {p.metricas.vistas === 1 ? "vista" : "vistas"} ({numero(p.metricas.vistasUnicas)}{" "}
                        {p.metricas.vistasUnicas === 1 ? "asociado" : "asociados"}) · {numero(p.metricas.clics)}{" "}
                        {p.metricas.clics === 1 ? "clic" : "clics"} en WhatsApp
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
