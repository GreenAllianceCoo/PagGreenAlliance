import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { listarEquipo } from "@/lib/admin/equipo";
import { cargarHistorialEquipo } from "@/lib/admin/historialEquipo";
import { exigirAdmin } from "@/lib/admin/servidor";
import { esquemaFiltrosHistorial, FILAS_HISTORIAL } from "@/lib/validaciones/historialEquipo";

export const metadata: Metadata = { title: "Historial del equipo · Admin · Green Alliance" };

const CLASE_CONTROL =
  "h-12 w-full min-w-0 rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] [color-scheme:dark]";
const CLASE_ETIQUETA = "text-13 font-bold uppercase tracking-[0.04em] text-admin-texto-3";

type Busqueda = { persona?: string; desde?: string; hasta?: string; pagina?: string };

/**
 * «Historial del equipo» (solo admin): qué hizo cada admin y secretario, en lenguaje claro
 * («Aprobó la afiliación de Juan Pérez · 2 oct 2026 10:15»), con filtros por persona y fechas
 * y paginado. Sale de los historiales que ya existen (afiliaciones, proceso ejecutivo, asesor,
 * rol, bajas y créditos) por la función admin_historial_equipo().
 */
export default async function HistorialEquipoPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { supabase, nombre } = await exigirAdmin();
  const filtros = esquemaFiltrosHistorial.parse(await searchParams);
  const [{ eventos, total, error }, { personas }] = await Promise.all([
    cargarHistorialEquipo(supabase, filtros),
    listarEquipo(supabase),
  ]);
  // Quienes pueden aparecer como autores: admins, secretarios y asesores.
  const autores = personas;
  const paginas = Math.max(1, Math.ceil(total / FILAS_HISTORIAL));

  const enlace = (pagina: number) => {
    const p = new URLSearchParams();
    if (filtros.persona) p.set("persona", filtros.persona);
    if (filtros.desde) p.set("desde", filtros.desde);
    if (filtros.hasta) p.set("hasta", filtros.hasta);
    if (pagina > 1) p.set("pagina", String(pagina));
    const texto = p.toString();
    return `/admin/historial${texto ? `?${texto}` : ""}`;
  };
  const hayFiltros = Boolean(filtros.persona || filtros.desde || filtros.hasta);

  return (
    <AdminShell nombre={nombre} seccion="historial">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Historial del equipo</h1>
      <p className="m-0 max-w-[640px] text-14 text-admin-texto-2">
        Lo que hicieron los administradores y secretarios: afiliaciones, procesos ejecutivos, asignaciones de asesor, cambios de rol,
        bajas y créditos. Lo más reciente primero. Las horas son de Colombia.
      </p>

      <form role="search" aria-label="Filtrar el historial" className="grid max-w-[900px] grid-cols-1 gap-3.5 rounded-20 bg-admin-superficie p-5.5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="historial-persona" className={CLASE_ETIQUETA}>
            Persona
          </label>
          <select id="historial-persona" name="persona" defaultValue={filtros.persona ?? ""} className={CLASE_CONTROL}>
            <option value="">Todas</option>
            {autores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} ({p.rol === "admin" ? "administrador" : p.rol})
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="historial-desde" className={CLASE_ETIQUETA}>
            Desde
          </label>
          <input id="historial-desde" name="desde" type="date" defaultValue={filtros.desde ?? ""} className={CLASE_CONTROL} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="historial-hasta" className={CLASE_ETIQUETA}>
            Hasta
          </label>
          <input id="historial-hasta" name="hasta" type="date" defaultValue={filtros.hasta ?? ""} className={CLASE_CONTROL} />
        </div>
        <div className="flex gap-2.5">
          <button
            type="submit"
            className="flex h-11.5 items-center justify-center rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo"
          >
            Filtrar
          </button>
          {hayFiltros ? (
            <Link
              href="/admin/historial"
              className="flex h-11.5 items-center justify-center rounded-full px-5 text-14 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              Quitar filtros
            </Link>
          ) : null}
        </div>
      </form>

      {error ? (
        <p role="alert" className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar el historial. Intenta de nuevo.
        </p>
      ) : eventos.length === 0 ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-texto-3">
          {hayFiltros ? "No hay movimientos con esos filtros." : "Todavía no hay movimientos del equipo."}
        </p>
      ) : (
        <section aria-label="Movimientos del equipo" className="overflow-hidden rounded-20 bg-admin-superficie">
          <ol className="m-0 flex list-none flex-col p-0" data-testid="historial-equipo">
            {eventos.map((e, i) => (
              <li
                key={`${e.cuandoISO}-${i}`}
                className="flex flex-col gap-1 border-b border-admin-borde-sutil px-4.5 py-3.5 last:border-0"
              >
                <span className="text-15 font-bold text-admin-texto">
                  <span className="text-admin-verde-2">{e.actorNombre}</span> · {e.descripcion}
                </span>
                {e.motivo ? <span className="text-14 text-admin-texto-2">Motivo: {e.motivo}</span> : null}
                <span className="text-13 text-admin-texto-3">
                  {e.actorRol} · {e.cuando}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {total > FILAS_HISTORIAL ? (
        <nav aria-label="Páginas del historial" className="flex items-center gap-3 text-14">
          {filtros.pagina > 1 ? (
            <Link
              href={enlace(filtros.pagina - 1)}
              className="flex h-11 items-center rounded-full px-5 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              Anterior
            </Link>
          ) : null}
          <span className="text-admin-texto-2">
            Página {filtros.pagina} de {paginas} · {total} movimientos
          </span>
          {filtros.pagina < paginas ? (
            <Link
              href={enlace(filtros.pagina + 1)}
              className="flex h-11 items-center rounded-full px-5 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </AdminShell>
  );
}
