"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { resolverCredito, type EstadoAccionCredito } from "@/app/admin/creditos/actions";
import { ChipEstado } from "./ChipEstado";
import { ToastAdmin } from "./ToastAdmin";
import { TarjetaKpi } from "./TarjetaKpi";
import { coincideBusqueda } from "@/lib/admin/busqueda";
import { formatearFecha, formatearPesos } from "@/lib/cuenta";
import { formatTasa } from "@/lib/credito";
import { enmascararCedula } from "@/lib/mascara";
import { PAQUETES_DEMO, type PaqueteDemo } from "@/lib/asesor/datosDemo";
import type { CodigoGrado } from "@/lib/validaciones/afiliacion";
import { HISTORIAL_NOTAS_INTERNAS_HABILITADO } from "@/lib/admin/flags";

export type EstadoCredito = "pendiente" | "aprobado" | "rechazado";

export type FilaCreditoPanel = {
  id: string;
  estado: EstadoCredito;
  monto_solicitado: number;
  porcentaje_devolucion: "50" | "100";
  tasa_interes_mensual: number;
  grado: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  motivo_rechazo: string | null;
  nombre: string;
  cedula: string;
  /** `perfiles.telefono` (widening mínimo de la consulta existente; no hay «correo» disponible aquí, ver nota abajo). */
  telefono: string | null;
};

const VACIO: EstadoAccionCredito = {};
const ESTADOS = ["pendiente", "aprobado", "rechazado"] as const;

/**
 * Tope del paquete (grado + porcentaje) para el aviso «Dentro/Supera el
 * tope». `paquetesPorGrado` viene de `cargarPaquetesDemo` (la página de
 * servidor), que SIEMPRE intenta leer primero los topes reales de
 * `grados_credito`; solo cae a la copia de referencia (`PAQUETES_DEMO`) si
 * esa consulta falla. Así el aviso —y el bloqueo de «Aprobar» que depende de
 * él— usa el tope vigente de verdad, no una copia que puede desactualizarse.
 * De todos modos, aunque la UI se equivocara, el servidor (trigger
 * `chk_monto_solicitud` + `validar_monto_solicitud`) es quien de verdad
 * impide guardar un monto sobre el tope: esto es solo el aviso visual.
 */
function topeDelPaquete(
  paquetesPorGrado: Record<CodigoGrado, PaqueteDemo[]>,
  grado: string,
  porcentaje: "50" | "100",
): number | undefined {
  const paquetes = paquetesPorGrado[grado as CodigoGrado] ?? PAQUETES_DEMO[grado as CodigoGrado];
  return paquetes?.find((p) => p.porcentaje === porcentaje)?.capacidad_maxima;
}

type Props = {
  filas: FilaCreditoPanel[];
  estadoFiltro: EstadoCredito;
  /** Conteos de las 3 pestañas: solo la activa es exacta (viene de esta misma consulta); las otras 2 quedan sin número. */
  conteoFiltroActual: number;
  /** Topes reales de `grados_credito` (con la copia de referencia como respaldo), para el aviso «Dentro/Supera el tope». */
  paquetesPorGrado: Record<CodigoGrado, PaqueteDemo[]>;
  kpis: {
    creditosPendientes: number;
    afiliacionesPendientes: number;
    aprobadosEsteMes: number;
    montoAprobadoEsteMes: string;
  };
};

/**
 * Panel de créditos del admin oscuro (pieza 2d): KPIs, búsqueda, filtro por
 * estado, lista + detalle en la misma vista, aprobar en 2 pasos, rechazar
 * con motivo obligatorio, toast y atajos J/K/A/R/Esc.
 */
export function PanelCreditos({ filas, estadoFiltro, conteoFiltroActual, paquetesPorGrado, kpis }: Props) {
  const [busqueda, setBusqueda] = useState("");
  const filtradas = useMemo(() => filas.filter((f) => coincideBusqueda(busqueda, f.nombre, f.cedula)), [filas, busqueda]);

  // Sin efecto para «corregir» una selección inválida: se calcula en cada
  // render (patrón oficial de React para no duplicar estado derivado).
  const [seleccionadoId, setSeleccionadoId] = useState<string | undefined>(undefined);
  const idEfectivo = seleccionadoId && filtradas.some((f) => f.id === seleccionadoId) ? seleccionadoId : filtradas[0]?.id;
  const seleccionado = filtradas.find((f) => f.id === idEfectivo) ?? null;

  const [toast, setToast] = useState<string | null>(null);

  // Atajos J/K (mover la selección): A/R/Esc viven en <DetalleCredito>, que
  // es quien conoce el paso de confirmación de la fila actual.
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName ?? "");
      if (enCampo) return;
      const indice = filtradas.findIndex((f) => f.id === idEfectivo);
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        const siguiente = filtradas[Math.min(indice + 1, filtradas.length - 1)];
        if (siguiente) setSeleccionadoId(siguiente.id);
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        const anterior = filtradas[Math.max(indice - 1, 0)];
        if (anterior) setSeleccionadoId(anterior.id);
      }
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [filtradas, idEfectivo]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Créditos</h1>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o cédula"
          aria-label="Buscar por nombre o cédula"
          className="h-11.5 w-full max-w-xs rounded-full bg-admin-superficie px-4.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <TarjetaKpi etiqueta="Créditos pendientes" valor={kpis.creditosPendientes} tono="ambar" />
        <TarjetaKpi etiqueta="Afiliaciones pendientes" valor={kpis.afiliacionesPendientes} />
        <TarjetaKpi etiqueta="Aprobados este mes" valor={kpis.aprobadosEsteMes} tono="verde" />
        <TarjetaKpi etiqueta="Monto aprobado este mes" valor={kpis.montoAprobadoEsteMes} tono="verde" />
      </div>

      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <Link
            key={e}
            href={`/admin/creditos?estado=${e}`}
            aria-current={estadoFiltro === e ? "page" : undefined}
            className={
              "flex h-10 items-center gap-1.5 rounded-full px-4.5 text-14 font-bold no-underline " +
              (estadoFiltro === e ? "bg-admin-texto text-admin-fondo" : "text-admin-texto-2 hover:bg-admin-superficie")
            }
          >
            {e[0].toUpperCase() + e.slice(1)}
            {estadoFiltro === e ? <span className="opacity-70">{conteoFiltroActual}</span> : null}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[minmax(0,1fr)_460px]">
        <section className="overflow-hidden rounded-20 bg-admin-superficie">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2.5 border-b border-admin-borde-sutil px-4.5 py-3.5 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3 lg:grid-cols-[2fr_1.1fr_1fr_1fr_.9fr]">
            <span>Asociado</span>
            <span className="hidden lg:block">Grado</span>
            <span>Monto</span>
            <span className="hidden lg:block">Recibida</span>
            <span>Estado</span>
          </div>
          {filtradas.length === 0 ? (
            <p className="m-0 p-9 text-center text-15 text-admin-texto-3">
              Nada por aquí. Cuando llegue una solicitud la verás aparecer resaltada.
            </p>
          ) : (
            filtradas.map((f, indice) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSeleccionadoId(f.id)}
                style={{ animationDelay: `${indice * 70}ms` }}
                className={
                  "grid w-full grid-cols-[2fr_1fr_1fr] items-center gap-2.5 border-b border-admin-borde-sutil px-4.5 py-3.5 text-left transition-colors duration-200 last:border-0 motion-safe:animate-ga-fila-entra lg:grid-cols-[2fr_1.1fr_1fr_1fr_.9fr] " +
                  (f.id === idEfectivo ? "bg-admin-superficie-2" : "hover:bg-admin-superficie-2/60")
                }
              >
                <span className="flex flex-col gap-0.5 truncate">
                  <span className="truncate text-15 font-extrabold text-white">{f.nombre}</span>
                  <span className="text-13 tracking-cedula text-admin-texto-3">{enmascararCedula(f.cedula)}</span>
                </span>
                <span className="hidden text-14 text-admin-texto-2 lg:block">{f.grado}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-15 font-bold tabular-nums">{formatearPesos(f.monto_solicitado)}</span>
                </span>
                <span className="hidden text-14 text-admin-texto-2 lg:block">{formatearFecha(f.fecha_solicitud)}</span>
                <span className="justify-self-start">
                  <ChipEstado estado={f.estado} />
                </span>
              </button>
            ))
          )}
        </section>

        {seleccionado ? (
          <DetalleCredito
            // `key`: al cambiar de fila se remonta y su estado local (paso de
            // confirmación, resultado de la Server Action) arranca de nuevo,
            // sin necesitar un efecto que lo reinicie.
            key={seleccionado.id}
            fila={seleccionado}
            paquetesPorGrado={paquetesPorGrado}
            onResuelto={(mensaje) => setToast(mensaje)}
          />
        ) : (
          <section className="flex flex-col gap-4.5 rounded-20 bg-admin-superficie p-5.5">
            <p className="m-0 p-6 text-center text-15 text-admin-texto-3">Elige una solicitud de la lista.</p>
          </section>
        )}
      </div>

      <ToastAdmin mensaje={toast} onCerrar={() => setToast(null)} />
    </div>
  );
}

/** Ficha de una solicitud (columna derecha): un componente aparte para que
 * el `key={fila.id}` del padre reinicie su estado local al cambiar de fila. */
function DetalleCredito({
  fila,
  paquetesPorGrado,
  onResuelto,
}: {
  fila: FilaCreditoPanel;
  paquetesPorGrado: Record<CodigoGrado, PaqueteDemo[]>;
  onResuelto: (mensaje: string) => void;
}) {
  const [paso, setPaso] = useState<"idle" | "aprobar" | "rechazar">("idle");
  const [estadoAccion, accion] = useActionState(resolverCredito, VACIO);

  // Notifica al padre (toast) cuando la Server Action termina con éxito. No
  // hay setState local aquí: `onResuelto` es una función que llegó por
  // props, así que esto es «sincronizar con un sistema externo» (el padre),
  // el uso previsto de un efecto.
  useEffect(() => {
    if (estadoAccion.mensaje) onResuelto(estadoAccion.mensaje);
  }, [estadoAccion.mensaje, onResuelto]);

  // Atajos A/R/Esc, solo mientras esta ficha está montada (fila seleccionada).
  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName ?? "");
      if (e.key === "Escape") {
        setPaso("idle");
        return;
      }
      if (enCampo || fila.estado !== "pendiente") return;
      if (e.key === "a" || e.key === "A") setPaso("aprobar");
      else if (e.key === "r" || e.key === "R") setPaso("rechazar");
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [fila.estado]);

  const tope = topeDelPaquete(paquetesPorGrado, fila.grado, fila.porcentaje_devolucion);
  const dentroDelTope = tope !== undefined ? fila.monto_solicitado <= tope : undefined;

  return (
    <section className="flex flex-col gap-4.5 rounded-20 bg-admin-superficie p-5.5">
      <div className="flex items-center justify-between">
        <ChipEstado estado={fila.estado} tamano="md" />
        <span className="text-13 text-admin-texto-3">{formatearFecha(fila.fecha_solicitud)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-26 font-extrabold leading-115">{fila.nombre}</span>
        <span className="text-14 text-admin-texto-2">
          C.C. {fila.cedula} · {fila.grado}
        </span>
      </div>

      {/* «Correo» no está en esta consulta (vive en auth.users, no en
          perfiles): traerlo requeriría el cliente admin (service role)
          desde una página de servidor, algo que no se agrega aquí.
          TODO(backend): si se necesita, ga-funcionalidad-botones puede
          exponerlo con una función igual a `correoDeCedula`. */}
      {fila.telefono ? (
        <div className="rounded-12 bg-admin-superficie-2 px-3 py-2.5 text-14">
          <div className="text-admin-texto-3">Celular</div>
          <div className="font-bold">{fila.telefono}</div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="font-display text-44 font-extrabold leading-none tracking-cifra-grande">
          {formatearPesos(fila.monto_solicitado)}
        </span>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-admin-superficie-2 px-[11px] py-1.5 text-13 font-bold">
            {fila.porcentaje_devolucion}%
          </span>
          <span className="rounded-full bg-admin-superficie-2 px-[11px] py-1.5 text-13 font-bold">
            {formatTasa(Number(fila.tasa_interes_mensual))} mensual
          </span>
        </div>
      </div>

      {dentroDelTope === true ? (
        <div className="rounded-14 bg-admin-verde-fondo p-3.5 text-14 leading-145 text-admin-verde-claro">
          <strong className="text-admin-verde-2">Dentro del tope.</strong> Tope del grado: {formatearPesos(tope!)}.
        </div>
      ) : dentroDelTope === false ? (
        <div className="rounded-14 bg-admin-rojo-fondo p-3.5 text-14 leading-145 text-admin-rojo-claro">
          <strong className="text-admin-rojo-2">Supera el tope por {formatearPesos(fila.monto_solicitado - tope!)}.</strong>{" "}
          Tope del grado: {formatearPesos(tope!)}. No se puede aprobar; recházala con el motivo.
        </div>
      ) : null}

      {fila.estado !== "pendiente" ? (
        <p className="m-0 rounded-14 bg-admin-superficie-2 p-3.5 text-14 text-admin-texto-2">
          {fila.estado === "aprobado"
            ? "Este crédito ya fue aprobado. No hay más acciones disponibles."
            : `Rechazado${fila.motivo_rechazo ? `. Motivo: ${fila.motivo_rechazo}` : "."}`}
        </p>
      ) : paso === "idle" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setPaso("aprobar")}
            disabled={dentroDelTope === false}
            title={dentroDelTope === false ? "Supera el tope: no se puede aprobar" : "Aprobar (A)"}
            className="flex h-12.5 items-center justify-center rounded-full bg-admin-verde text-16 font-extrabold text-admin-fondo disabled:cursor-not-allowed disabled:opacity-40"
          >
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => setPaso("rechazar")}
            title="Rechazar (R)"
            className="flex h-12.5 items-center justify-center rounded-full text-16 font-extrabold text-admin-rojo-2 shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]"
          >
            Rechazar
          </button>
        </div>
      ) : paso === "aprobar" ? (
        <div className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]">
          <p className="m-0 text-15 leading-150">
            ¿Aprobar <strong>{formatearPesos(fila.monto_solicitado)}</strong> a <strong>{fila.nombre}</strong>? Le
            enviaremos un correo con la aprobación.
          </p>
          <form action={accion} className="flex gap-2.5">
            <input type="hidden" name="id" value={fila.id} />
            <input type="hidden" name="decision" value="aprobado" />
            <BotonAdmin variante="verde" textoCargando="Aprobando…">
              Sí, aprobar
            </BotonAdmin>
            <BotonCancelar onClick={() => setPaso("idle")} />
          </form>
        </div>
      ) : (
        <form
          action={accion}
          className="flex flex-col gap-2.5 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]"
        >
          <input type="hidden" name="id" value={fila.id} />
          <input type="hidden" name="decision" value="rechazado" />
          <label htmlFor="motivo-rechazo" className="text-14 font-bold">
            Motivo del rechazo <span className="font-medium text-admin-texto-3">(obligatorio · lo verá el asociado)</span>
          </label>
          <textarea
            id="motivo-rechazo"
            name="motivo"
            rows={3}
            required
            placeholder="Ej.: Tienes un crédito vigente con saldo pendiente."
            aria-invalid={estadoAccion.error ? true : undefined}
            className="resize-none rounded-12 bg-admin-fondo p-3 text-16 leading-140 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]"
          />
          {estadoAccion.error ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{estadoAccion.error}</p> : null}
          <div className="flex gap-2.5">
            <BotonAdmin variante="rojo" textoCargando="Guardando…">
              Rechazar crédito
            </BotonAdmin>
            <BotonCancelar onClick={() => setPaso("idle")} />
          </div>
        </form>
      )}

      {/* TODO(backend: migración 20260925200200_historial_y_notas_internas.sql
          sin aplicar): la nota interna se queda OCULTA en vez de mostrarse
          sin guardar nada — un textarea visible que no persiste podría
          hacerle perder al admin una nota que cree que ya quedó guardada.
          Cuando esa migración se aplique, poner HISTORIAL_NOTAS_INTERNAS_HABILITADO
          en `true` (lib/admin/flags.ts) y conectar este campo a la Server
          Action que llame a `agregar_nota_solicitud`. */}
      {HISTORIAL_NOTAS_INTERNAS_HABILITADO ? <NotaInternaCredito /> : null}

      <div className="flex flex-col gap-2.5">
        <span className="text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">Historial</span>
        <ItemHistorial titulo="Envió la solicitud" fecha={fila.fecha_solicitud} />
        {fila.estado !== "pendiente" && fila.fecha_respuesta ? (
          <ItemHistorial titulo={fila.estado === "aprobado" ? "Aprobada" : "Rechazada"} fecha={fila.fecha_respuesta} />
        ) : null}
      </div>
    </section>
  );
}

/**
 * Nota interna (crédito): solo se monta cuando `HISTORIAL_NOTAS_INTERNAS_HABILITADO`
 * es `true` (lib/admin/flags.ts), es decir, cuando ya exista dónde guardarla
 * (ver TODO(backend) en el lugar donde se usa este componente). Mientras
 * tanto queda fuera de la vista para no insinuar que algo se guarda.
 */
function NotaInternaCredito() {
  const [notaInterna, setNotaInterna] = useState("");
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="nota-interna" className="text-14 font-bold">
        Nota interna <span className="font-medium text-admin-texto-3">· solo la ve el equipo</span>
      </label>
      <textarea
        id="nota-interna"
        rows={2}
        value={notaInterna}
        onChange={(e) => setNotaInterna(e.target.value)}
        placeholder="Ej.: Llamó para confirmar el plazo."
        className="resize-none rounded-12 bg-admin-fondo p-3 text-16 leading-140 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]"
      />
    </div>
  );
}

function ItemHistorial({ titulo, fecha }: { titulo: string; fecha: string }) {
  return (
    <div className="flex gap-2.5 text-14 leading-140">
      <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-none rounded-full bg-admin-verde" />
      <span className="flex flex-col">
        <span className="font-bold text-admin-texto">{titulo}</span>
        <span className="text-admin-texto-3">
          {new Date(fecha).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" })}
        </span>
      </span>
    </div>
  );
}

function BotonCancelar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
    >
      Cancelar
    </button>
  );
}

/** Botón de envío del paso de confirmación: se deshabilita solo mientras el <form> está enviando. */
function BotonAdmin({
  variante,
  textoCargando,
  children,
}: {
  variante: "verde" | "rojo";
  textoCargando: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const claseColor = variante === "verde" ? "bg-admin-verde text-admin-fondo" : "bg-admin-rojo text-admin-fondo";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`flex h-11.5 flex-1 items-center justify-center gap-2 rounded-full text-15 font-extrabold disabled:opacity-85 ${claseColor}`}
    >
      {pending ? textoCargando : children}
    </button>
  );
}
