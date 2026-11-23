import type { Metadata } from "next";
import Link from "next/link";
import { AccionesPublicacionAdmin } from "@/components/admin/AccionesPublicacionAdmin";
import { AdminShell } from "@/components/admin/AdminShell";
import { listarPublicacionesAdmin } from "@/lib/admin/publicacionesConvenio";
import { exigirAdmin } from "@/lib/admin/servidor";
import { fechaCorta, type EstadoPublicacion } from "@/lib/convenio/publicaciones";
import { esquemaFiltrosPublicaciones } from "@/lib/validaciones/publicacionesConvenio";

export const metadata: Metadata = { title: "Publicaciones de convenios · Admin · Green Alliance" };

const CLASE_CONTROL =
  "h-12 w-full min-w-0 rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] [color-scheme:dark]";
const CLASE_ETIQUETA = "text-13 font-semibold text-admin-texto-3";

const ETIQUETA_ESTADO: Record<EstadoPublicacion, { texto: string; clase: string }> = {
  publicada: { texto: "Publicada", clase: "text-admin-verde-2" },
  programada: { texto: "Programada", clase: "text-admin-texto-2" },
  vencida: { texto: "Vencida", clase: "text-admin-texto-3" },
  oculta: { texto: "Oculta", clase: "text-admin-ambar" },
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «21 nov 2026 10:15», hora de Colombia. */
function cuando(instante: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instante))
      .map((x) => [x.type, x.value]),
  );
  return `${Number(p.day)} ${MESES[Number(p.month) - 1]} ${p.year} ${p.hour}:${p.minute}`;
}

function vigencia(iniciaEl: string | null, terminaEl: string | null) {
  if (iniciaEl && terminaEl) return `Del ${fechaCorta(iniciaEl, true)} al ${fechaCorta(terminaEl, true)}`;
  if (terminaEl) return `Hasta el ${fechaCorta(terminaEl, true)}`;
  if (iniciaEl) return `Desde el ${fechaCorta(iniciaEl, true)}`;
  return "Sin fecha de vencimiento";
}

const numero = (n: number) => new Intl.NumberFormat("es-CO").format(n);

type Busqueda = { convenio?: string; tipo?: string; estado?: string };

/**
 * Publicaciones de todos los convenios (docs/spec-convenios.md §B4): filtro por
 * convenio, tipo y estado; «Ocultar» con motivo opcional y «Volver a mostrar».
 * Quién ocultó y cuándo queda en la fila y en el Historial del equipo.
 */
export default async function PublicacionesConveniosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { supabase, nombre } = await exigirAdmin();
  const filtros = esquemaFiltrosPublicaciones.parse(await searchParams);
  const { publicaciones, convenios, total, error } = await listarPublicacionesAdmin(supabase, filtros);
  const hayFiltros = Boolean(filtros.convenio || filtros.tipo || filtros.estado);

  return (
    <AdminShell nombre={nombre} seccion="convenios">
      <div className="flex flex-col gap-1.5">
        <Link href="/admin/convenios" className="self-start text-14 font-semibold text-admin-verde-2 no-underline hover:underline">
          ← Convenios
        </Link>
        <h1 className="m-0 font-display text-30 font-semibold tracking-titular lg:text-34">Publicaciones de convenios</h1>
        <p className="m-0 max-w-[640px] text-14 text-admin-texto-2">
          Lo que publican los convenios sale en Beneficios sin aprobación. Si algo no debe estar ahí, ocúltalo: deja de verse al
          instante y el convenio ve el motivo.
        </p>
      </div>

      <form
        role="search"
        aria-label="Filtrar publicaciones"
        className="grid max-w-[900px] grid-cols-1 gap-3.5 rounded-20 bg-admin-superficie p-5.5 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pub-convenio" className={CLASE_ETIQUETA}>
            Convenio
          </label>
          <select id="pub-convenio" name="convenio" defaultValue={filtros.convenio ?? ""} className={CLASE_CONTROL}>
            <option value="">Todos</option>
            {convenios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pub-tipo" className={CLASE_ETIQUETA}>
            Tipo
          </label>
          <select id="pub-tipo" name="tipo" defaultValue={filtros.tipo ?? ""} className={CLASE_CONTROL}>
            <option value="">Todos</option>
            <option value="promocion">Promociones</option>
            <option value="catalogo">Catálogos</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pub-estado" className={CLASE_ETIQUETA}>
            Estado
          </label>
          <select id="pub-estado" name="estado" defaultValue={filtros.estado ?? ""} className={CLASE_CONTROL}>
            <option value="">Todos</option>
            <option value="publicada">Publicadas</option>
            <option value="programada">Programadas</option>
            <option value="vencida">Vencidas</option>
            <option value="oculta">Ocultas</option>
          </select>
        </div>
        <div className="flex gap-2.5 sm:col-span-3 lg:col-span-1">
          <button type="submit" className="flex h-11.5 items-center justify-center rounded-full bg-admin-verde px-6 text-14 font-semibold text-admin-fondo">
            Filtrar
          </button>
          {hayFiltros ? (
            <Link
              href="/admin/convenios/publicaciones"
              className="flex h-11.5 items-center justify-center rounded-full px-5 text-14 font-semibold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              Quitar filtros
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las publicaciones. Recarga la página.
        </p>
      ) : publicaciones.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">
          {hayFiltros ? "No hay publicaciones con esos filtros." : "Los convenios todavía no han publicado nada."}
        </p>
      ) : (
        <section aria-label="Publicaciones" className="flex flex-col gap-2 rounded-20 bg-admin-superficie p-3.5 sm:p-5.5">
          <p className="m-0 text-14 text-admin-texto-3">
            {hayFiltros ? `${publicaciones.length} de ${total}` : `${total}`} {total === 1 ? "publicación" : "publicaciones"}
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="publicaciones-admin">
            {publicaciones.map((p) => {
              const etiqueta = ETIQUETA_ESTADO[p.estado];
              return (
                <li key={p.id} className="flex flex-col gap-3 rounded-14 bg-admin-superficie-2 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-10 bg-admin-fondo text-12 font-semibold text-admin-texto-3">
                      {p.portada ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.portada} alt="" className="h-full w-full object-cover" />
                      ) : (
                        "PDF"
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-13 text-admin-texto-3">
                        {p.convenioNombre} · {p.tipo === "promocion" ? "Promoción" : p.pdfPath ? "Catálogo en PDF" : "Catálogo"}
                        {p.beneficio ? ` · ${p.beneficio}` : ""}
                      </span>
                      <span className="text-16 font-semibold text-white">{p.titulo}</span>
                      {p.descripcion ? <span className="line-clamp-2 text-14 text-admin-texto-2">{p.descripcion}</span> : null}
                      <span className="text-13 text-admin-texto-3">
                        <span className={"font-semibold " + etiqueta.clase}>{etiqueta.texto}</span> · {vigencia(p.iniciaEl, p.terminaEl)}
                      </span>
                      <span className="text-13 text-admin-texto-3">
                        {numero(p.metricas.vistas)} {p.metricas.vistas === 1 ? "vista" : "vistas"} · {numero(p.metricas.clics)}{" "}
                        {p.metricas.clics === 1 ? "clic" : "clics"} en WhatsApp · Publicada el {cuando(p.creadaEn)}
                      </span>
                      {p.ocultaEn ? (
                        <span className="text-13 text-admin-ambar">
                          Oculta por {p.ocultaPorNombre ?? "Green Alliance"} el {cuando(p.ocultaEn)}
                          {p.ocultaMotivo ? ` · Motivo: ${p.ocultaMotivo}` : " · Sin motivo"}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {p.archivoUrl ? (
                      <a
                        href={p.archivoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-11 items-center justify-center rounded-10 px-4 text-14 font-semibold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie"
                      >
                        {p.pdfPath ? "Ver PDF" : p.imagenes.length > 1 ? `Ver imagen (1 de ${p.imagenes.length})` : "Ver imagen"}
                      </a>
                    ) : null}
                    <AccionesPublicacionAdmin id={p.id} titulo={p.titulo} oculta={Boolean(p.ocultaEn)} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AdminShell>
  );
}
