"use client";

import { useActionState, useState } from "react";
import { actualizarProcesoEjecutivo, type EstadoActualizarProceso } from "@/app/admin/asociados/actions";
import type { DetalleProcesoAsociado as Detalle } from "@/lib/admin/asociados";
import { ESTADOS_PROCESO, ETIQUETA_ESTADO_PROCESO } from "@/lib/procesoEjecutivo";
import { BotonAdmin, CampoAdmin, EntradaAdmin, SelectAdmin } from "./CamposAdmin";
import { ToastAdmin } from "./ToastAdmin";

const INICIAL: EstadoActualizarProceso = {};

/**
 * Ficha del asociado (pieza 3m): selector de estado, fecha de inicio del embargo e historial.
 * RS-01: `bloqueado` = el admin en sesión es el asesor de este asociado (o es él mismo):
 * otro administrador debe cambiar el proceso (la base también lo impide).
 */
export function DetalleProcesoAsociado({ detalle, bloqueado = false }: { detalle: Detalle; bloqueado?: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  const [estado, despachar] = useActionState(async (p: EstadoActualizarProceso, f: FormData) => {
    const r = await actualizarProcesoEjecutivo(p, f);
    if (r.mensaje) setToast(r.mensaje);
    return r;
  }, INICIAL);
  const { asociado } = detalle;

  return (
    <section className="flex flex-col gap-4 rounded-20 bg-admin-superficie p-5.5">
      <div className="flex flex-col gap-1">
        {/* En celular el nombre ya es el h1 de la página (pieza 3m). */}
        <span className="hidden font-display text-24 font-extrabold leading-115 lg:inline">{asociado.nombre}</span>
        <span className="text-14 text-admin-texto-2">
          C.C. {asociado.cedula} · {asociado.grado ?? "Sin grado"} · {asociado.institucion ?? "—"}
        </span>
      </div>
      <form action={despachar} noValidate className="flex flex-col gap-4">
        <input type="hidden" name="asociadoId" value={asociado.id} />
        {bloqueado ? (
          <p role="status" className="m-0 text-14 font-semibold text-admin-texto-2">
            Este proceso es tuyo o de uno de tus clientes: otro administrador debe actualizarlo.
          </p>
        ) : null}
        <CampoAdmin
          id="proceso-estado"
          label="Estado del proceso ejecutivo"
          error={estado.errores?.estado}
          ayuda="Solo el admin lo cambia; el asociado lo ve en su perfil, sin poder editarlo."
        >
          {(c) => (
            <SelectAdmin {...c} name="estado" defaultValue={detalle.estado ?? "reparto"} disabled={bloqueado}>
              {ESTADOS_PROCESO.map((e, i) => (
                <option key={e} value={e}>
                  {ETIQUETA_ESTADO_PROCESO[e]} (paso {i + 1} de 8)
                </option>
              ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
        <CampoAdmin
          id="proceso-fecha"
          label="Fecha de inicio del embargo"
          error={estado.errores?.fechaInicioEmbargo}
          ayuda="Por defecto, la fecha en que pasó a «Operando». El admin puede ajustarla."
        >
          {(c) => (
            <EntradaAdmin
              {...c}
              name="fechaInicioEmbargo"
              type="date"
              defaultValue={detalle.fechaInicioEmbargo ?? ""}
              disabled={bloqueado}
              className="[color-scheme:dark]"
            />
          )}
        </CampoAdmin>
        {estado.error ? (
          <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
            {estado.error}
          </p>
        ) : null}
        <BotonAdmin textoCargando="Guardando…" className="self-start" deshabilitado={bloqueado}>
          Guardar cambios
        </BotonAdmin>
      </form>

      <div className="flex flex-col gap-2.5">
        <h2 className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">Historial del proceso</h2>
        {detalle.historial.length === 0 ? (
          <p className="m-0 text-14 text-admin-texto-3">Todavía no hay cambios.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {detalle.historial.map((h, i) => (
              <li key={h.id} className="flex gap-2.5 text-14 leading-140 motion-safe:animate-ga-fila-entra">
                <span
                  aria-hidden="true"
                  className={"mt-1.5 h-2 w-2 flex-none rounded-full bg-admin-verde " + (i > 0 ? "opacity-50" : "")}
                />
                <span className="flex flex-col">
                  <span className="font-bold text-admin-texto">
                    Cambió el proceso a «{h.estadoNuevo}»
                    {h.fechaInicioEmbargoTexto ? ` · fecha de embargo: ${h.fechaInicioEmbargoTexto}` : ""}
                  </span>
                  <span className="text-admin-texto-3">
                    {h.adminNombre ?? "Administrador"} · {h.cuando}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ToastAdmin mensaje={toast} onCerrar={() => setToast(null)} />
    </section>
  );
}
