import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { FotoAfiliacion } from "@/components/admin/FotoAfiliacion";
import { cargarCambiosAsociados, nombreDeAsociado } from "@/lib/admin/cambiosAsociados";
import { exigirAdmin } from "@/lib/admin/servidor";
import { esquemaFiltrosCambios, FILAS_CAMBIOS } from "@/lib/validaciones/cambiosAsociados";

export const metadata: Metadata = { title: "Cambios · Admin · Green Alliance" };

const CLASE_CONTROL =
  "h-12 w-full min-w-0 rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] [color-scheme:dark]";
const CLASE_ETIQUETA = "text-13 font-bold uppercase tracking-[0.04em] text-admin-texto-3";
const CLASE_BOTON_BORDE =
  "flex h-11.5 items-center justify-center rounded-full px-5 text-14 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]";

type Busqueda = { asociado?: string; q?: string; desde?: string; hasta?: string; pagina?: string };

/**
 * «Cambios» (solo admin, pedido de Sebas 8-nov): cada cambio en los asociados, lo más
 * reciente primero. Datos y cédula con el valor anterior y el nuevo; fotos de afiliación
 * con la de antes y la de después; foto del carné, correo de ingreso, asesor, baja,
 * proceso ejecutivo y sus PDF. Filtros por asociado (desde su ficha), búsqueda y fechas.
 */
export default async function CambiosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { supabase, nombre } = await exigirAdmin();
  const filtros = esquemaFiltrosCambios.parse(await searchParams);
  const [{ cambios, total, error }, nombreFiltro] = await Promise.all([
    cargarCambiosAsociados(supabase, filtros),
    filtros.asociado ? nombreDeAsociado(supabase, filtros.asociado) : Promise.resolve(null),
  ]);
  const paginas = Math.max(1, Math.ceil(total / FILAS_CAMBIOS));

  const enlace = (pagina: number) => {
    const p = new URLSearchParams();
    if (filtros.asociado) p.set("asociado", filtros.asociado);
    if (filtros.q) p.set("q", filtros.q);
    if (filtros.desde) p.set("desde", filtros.desde);
    if (filtros.hasta) p.set("hasta", filtros.hasta);
    if (pagina > 1) p.set("pagina", String(pagina));
    const texto = p.toString();
    return `/admin/cambios${texto ? `?${texto}` : ""}`;
  };
  const hayFiltros = Boolean(filtros.asociado || filtros.q || filtros.desde || filtros.hasta);

  return (
    <AdminShell nombre={nombre} seccion="cambios">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">
        {nombreFiltro ? `Cambios de ${nombreFiltro}` : "Cambios"}
      </h1>
      <p className="m-0 max-w-[700px] text-14 text-admin-texto-2">
        Cada cambio en los asociados: datos y cédula (con el valor anterior y el nuevo), fotos de afiliación (la de antes y la de
        después), foto del carné, correo de ingreso, asesor, bajas, proceso ejecutivo y sus documentos. Lo más reciente primero. Las
        horas son de Colombia.
      </p>

      <form
        role="search"
        aria-label="Filtrar los cambios"
        className="grid max-w-[900px] grid-cols-1 gap-3.5 rounded-20 bg-admin-superficie p-5.5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end"
      >
        {filtros.asociado ? <input type="hidden" name="asociado" value={filtros.asociado} /> : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cambios-q" className={CLASE_ETIQUETA}>
            Asociado
          </label>
          <input
            id="cambios-q"
            name="q"
            type="search"
            defaultValue={filtros.q ?? ""}
            placeholder="Nombre o cédula completa"
            maxLength={80}
            className={CLASE_CONTROL}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cambios-desde" className={CLASE_ETIQUETA}>
            Desde
          </label>
          <input id="cambios-desde" name="desde" type="date" defaultValue={filtros.desde ?? ""} className={CLASE_CONTROL} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cambios-hasta" className={CLASE_ETIQUETA}>
            Hasta
          </label>
          <input id="cambios-hasta" name="hasta" type="date" defaultValue={filtros.hasta ?? ""} className={CLASE_CONTROL} />
        </div>
        <div className="flex gap-2.5">
          <button
            type="submit"
            className="flex h-11.5 items-center justify-center rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <Link href="/admin/cambios" className={CLASE_BOTON_BORDE}>
              Quitar filtros
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar los cambios. Intenta de nuevo.
        </p>
      ) : cambios.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">
          {hayFiltros ? "No hay cambios con esos filtros." : "Todavía no hay cambios registrados."}
        </p>
      ) : (
        <section aria-label="Cambios de los asociados" className="overflow-hidden rounded-20 bg-admin-superficie">
          <ol className="m-0 flex list-none flex-col p-0" data-testid="cambios-asociados">
            {cambios.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 border-b border-admin-borde-sutil px-4.5 py-4 last:border-0">
                <span className="text-15 font-bold text-admin-texto">
                  {filtros.asociado ? null : (
                    <>
                      <Link href={`/admin/asociados/${c.asociadoId}`} className="text-admin-verde-2 underline-offset-2 hover:underline">
                        {c.asociadoNombre}
                      </Link>
                      {" · "}
                    </>
                  )}
                  {c.titulo}
                </span>

                {c.lineas.length > 0 ? (
                  <dl className="m-0 grid grid-cols-1 gap-1.5 text-14 sm:grid-cols-[minmax(160px,auto)_1fr]">
                    {c.lineas.map((l) => (
                      <div key={l.etiqueta} className="contents">
                        <dt className="text-admin-texto-3">{l.etiqueta}</dt>
                        <dd className="m-0 break-words text-admin-texto-2">
                          <span className="line-through">{l.antes}</span>
                          <span aria-hidden="true" className="px-1.5 text-admin-texto-3">
                            →
                          </span>
                          <span className="sr-only"> cambió a </span>
                          <strong className="font-bold text-admin-texto">{l.despues}</strong>
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {c.foto ? (
                  <div className="grid max-w-[420px] grid-cols-2 gap-3">
                    {c.foto.teniaAnterior ? (
                      <FotoAfiliacion etiqueta="Antes" url={c.foto.urlAnterior} />
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-13 font-bold text-admin-texto-2">Antes</span>
                        <div className="flex aspect-[3/4] items-center justify-center rounded-12 border-1.5 border-dashed border-admin-borde p-2.5 text-center text-12 text-admin-texto-3">
                          No tenía foto
                        </div>
                      </div>
                    )}
                    <FotoAfiliacion etiqueta="Después" url={c.foto.urlNueva} />
                  </div>
                ) : null}

                {c.motivo ? <span className="text-14 text-admin-texto-2">Motivo: {c.motivo}</span> : null}
                <span className="text-13 text-admin-texto-3">
                  {c.autor} · {c.cuando}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {total > FILAS_CAMBIOS ? (
        <nav aria-label="Páginas de los cambios" className="flex items-center gap-3 text-14">
          {filtros.pagina > 1 ? (
            <Link href={enlace(filtros.pagina - 1)} className={CLASE_BOTON_BORDE}>
              Anterior
            </Link>
          ) : null}
          <span className="text-admin-texto-2">
            Página {filtros.pagina} de {paginas} · {total} cambios
          </span>
          {filtros.pagina < paginas ? (
            <Link href={enlace(filtros.pagina + 1)} className={CLASE_BOTON_BORDE}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </AdminShell>
  );
}
