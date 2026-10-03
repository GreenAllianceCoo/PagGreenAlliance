import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { FormularioAsesor } from "@/components/admin/FormularioAsesor";
import { GestionEquipo } from "@/components/admin/GestionEquipo";
import { InterruptorAtiende } from "@/components/admin/InterruptorAtiende";
import { FormularioPagoComision, ListaPagosComision } from "@/components/admin/PagosComision";
import { exigirAdmin } from "@/lib/admin/servidor";
import { listarBitacoraPagos, listarEquipo, listarPagosComision } from "@/lib/admin/equipo";
import { opcionesPeriodoCorte } from "@/lib/asesor/comisiones";
import { listarPremiosAsesores } from "@/lib/admin/premiosAsesores";
import { ganadoresPorMeta } from "@/lib/asesor/premios";
import { fechaBogotaDeInstante, formatearFechaLarga, hoyBogota } from "@/lib/fechas";

export const metadata: Metadata = { title: "Asesores · Admin · Green Alliance" };

/** Equipo de asesores (con «Atiende asociados»), alta (pieza 3f) y pagos de comisión (pieza 3m, D-15). */
export default async function AsesoresPage() {
  const { supabase, nombre, userId } = await exigirAdmin();

  const [{ personas }, pagosTodos, bitacoraTodas, premios] = await Promise.all([
    listarEquipo(supabase),
    listarPagosComision(supabase),
    listarBitacoraPagos(supabase),
    listarPremiosAsesores(supabase),
  ]);

  // RS-16: los pagos propios del admin que atiende (y su bitácora) NO se listan:
  // su acumulado va oculto y solo se revela con `revelarAcumulado`, que suma al
  // contador. Así no hay una vía por la que lo vea sin contar.
  const propios = new Set(pagosTodos.pagos.filter((p) => p.asesorId === userId).map((p) => p.id));
  const pagos = pagosTodos.pagos.filter((p) => p.asesorId !== userId);
  const entradas = bitacoraTodas.entradas.filter((e) => !propios.has(e.pagoId));
  const totalPorAsesor = Object.fromEntries(Object.entries(pagosTodos.totalPorAsesor).filter(([id]) => id !== userId));
  const yoAtiendo = personas.some((p) => p.id === userId && p.atiende);

  const conConteos = await Promise.all(
    personas.map(async (a) => {
      const [clientes, afiliaciones] = await Promise.all([
        supabase.from("perfiles").select("id", { count: "exact", head: true }).eq("asesor_id", a.id),
        supabase.from("solicitudes_afiliacion").select("id", { count: "exact", head: true }).eq("asesor_id", a.id),
      ]);
      return { ...a, clientes: clientes.count ?? 0, afiliaciones: afiliaciones.count ?? 0 };
    }),
  );
  const ganadores = ganadoresPorMeta(new Map(personas.map((p) => [p.id, p.nombre])), premios);
  const fechaCorta = (instante: string | null) => (instante ? formatearFechaLarga(fechaBogotaDeInstante(instante)) : "nunca");
  const quienesCobran = personas.filter((p) => p.atiende && p.id !== userId).map((p) => ({ valor: p.id, etiqueta: p.nombre }));

  return (
    <AdminShell nombre={nombre} seccion="asesores">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Asesores</h1>

      <FormularioAsesor />
      <FormularioAsesor rol="secretario" />

      <section className="flex flex-col gap-2 rounded-20 bg-admin-superficie p-5.5">
        <h2 className="m-0 font-display text-20 font-extrabold">Asesores registrados</h2>
        <p className="m-0 text-14 text-admin-texto-2">
          Bono de 50 asociados ($1.000.000): {ganadores[50] ? `ganó ${ganadores[50]}` : "sin ganador todavía"} · Viaje por 100:{" "}
          {ganadores[100] ? `ganó ${ganadores[100]}` : "sin ganador todavía"}
        </p>
        {conConteos.length === 0 ? (
          <p className="m-0 text-15 text-admin-texto-3">Todavía no hay asesores.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {conConteos.map((a, indice) => (
              <li
                key={a.id}
                style={{ animationDelay: `${indice * 60}ms` }}
                className="flex flex-col gap-2 rounded-14 bg-admin-superficie-2 p-3.5 motion-safe:animate-ga-fila-entra sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-16 font-extrabold text-white">{a.nombre}</span>
                  <span className="text-13 text-admin-texto-3">
                    Cédula {a.cedula} · {a.rol === "admin" ? "Administrador" : a.rol === "secretario" ? "Secretario" : "Asesor"}
                    {a.activo ? "" : " · Inactivo"}
                  </span>
                  <span className="text-14 text-admin-texto-2">
                    {a.clientes} {a.clientes === 1 ? "cliente" : "clientes"} · {a.afiliaciones}{" "}
                    {a.afiliaciones === 1 ? "afiliación referida" : "afiliaciones referidas"}
                  </span>
                  {(() => {
                    const p = premios.get(a.id);
                    const toques = (p?.toques50 ?? 0) + (p?.toques100 ?? 0);
                    return (
                      <span className="text-13 text-admin-texto-3">
                        Premios: {p?.asociados ?? 0} asociados operando · {toques}{" "}
                        {toques === 1 ? "toque" : "toques"} en la sección · último: {fechaCorta(p?.ultimoClic ?? null)} · toques en 50:{" "}
                        {p?.toques50 ?? 0}, en 100: {p?.toques100 ?? 0} · aperturas: {p?.aperturas ?? 0}
                        {p?.gano50 ? " · Ganó el bono de 50" : ""}
                        {p?.gano100 ? " · Ganó el viaje de 100" : ""}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-col items-start gap-2 sm:items-end">
                  {a.rol === "admin" ? (
                    <InterruptorAtiende perfilId={a.id} nombre={a.nombre} atiende={a.atiendeAsociados} />
                  ) : null}
                  {/* Secretarios: desactivar/reactivar y cambiar rol; asesores: pasar a secretario. Nunca el propio. */}
                  <GestionEquipo perfilId={a.id} nombre={a.nombre} rol={a.rol} activo={a.activo} esPropio={a.id === userId} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {/* TODO(pendiente-spec): desactivar un asesor o un admin (solo está definido para secretarios). */}
      </section>

      <FormularioPagoComision asesores={quienesCobran} periodos={opcionesPeriodoCorte(hoyBogota())} />
      <ListaPagosComision
        pagos={pagos}
        totalPorAsesor={totalPorAsesor}
        bitacora={entradas}
        mostrarMiAcumulado={yoAtiendo}
      />
    </AdminShell>
  );
}
