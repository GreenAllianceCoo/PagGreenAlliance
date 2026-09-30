"use client";

import { useActionState, useState, useTransition } from "react";
import { revelarAcumulado } from "@/app/asesor/actions";
import {
  anularPagoComision,
  editarPagoComision,
  registrarPagoComision,
  type EstadoAnularPago,
  type EstadoEditarPago,
  type EstadoPagoComision,
} from "@/app/admin/asesores/actions";
import { CONCEPTOS_COMISION, ETIQUETA_CONCEPTO } from "@/lib/asesor/comisiones";
import type { AccionBitacoraPago, EntradaBitacoraPago, PagoComisionAdmin } from "@/lib/admin/equipo";
import { BotonAdmin, CampoAdmin, EntradaAdmin, SelectAdmin } from "./CamposAdmin";

type Opcion = { valor: string; etiqueta: string };

const INICIAL_PAGO: EstadoPagoComision = {};
const INICIAL_EDITAR: EstadoEditarPago = {};
const INICIAL_ANULAR: EstadoAnularPago = {};

/** Largo máximo del motivo (validaciones/admin.ts: 5–300 caracteres). */
const MAX_MOTIVO = 300;

/** Botón secundario de 44 px de alto (área táctil mínima, pieza 3o). */
const CLASE_BOTON_BORDE =
  "h-11 rounded-full px-4 text-13 font-bold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]";

/** Chip de color por acción de la bitácora (pieza 3o): Registro verde, Corrección ámbar, Anulación rojo. */
const CLASE_CHIP_ACCION: Record<AccionBitacoraPago, string> = {
  creacion: "bg-admin-verde-fondo text-admin-verde-2",
  edicion: "bg-admin-ambar-fondo text-admin-ambar",
  anulacion: "bg-admin-rojo-fondo text-admin-rojo-2",
};

/** «Anulado: No → Sí» de la base se muestra como «Estado: Vigente → Anulado» (pieza 3o). */
function cambioLegible(c: { campo: string; antes: string | null; despues: string | null }) {
  if (c.campo !== "Anulado") return c;
  const estado = (v: string | null) => (v === "Sí" ? "Anulado" : v === "No" ? "Vigente" : v);
  return { campo: "Estado", antes: estado(c.antes), despues: estado(c.despues) };
}

/** «Registrar pago de comisión» (pieza 3m): asesor, concepto, monto, periodo (corte del 15) y nota. */
export function FormularioPagoComision({ asesores, periodos }: { asesores: Opcion[]; periodos: Opcion[] }) {
  const [estado, despachar] = useActionState(registrarPagoComision, INICIAL_PAGO);
  const v = estado.valores;
  return (
    <form action={despachar} noValidate className="flex flex-col gap-4 rounded-20 bg-admin-superficie p-5.5">
      <h2 className="m-0 font-display text-20 font-extrabold">Registrar pago de comisión</h2>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <CampoAdmin id="pago-asesor" label="Asesor" error={estado.errores?.asesorId}>
          {(c) => (
            <SelectAdmin {...c} name="asesorId" defaultValue={v?.asesorId ?? ""}>
              <option value="">Elige el asesor</option>
              {asesores.map((a) => (
                <option key={a.valor} value={a.valor}>
                  {a.etiqueta}
                </option>
              ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
        <CampoAdmin id="pago-concepto" label="Concepto" error={estado.errores?.concepto}>
          {(c) => (
            <SelectAdmin {...c} name="concepto" defaultValue={v?.concepto ?? "ingreso_nuevo"}>
              {CONCEPTOS_COMISION.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETA_CONCEPTO[k]}
                </option>
              ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
        <CampoAdmin id="pago-monto" label="Monto" error={estado.errores?.monto}>
          {(c) => <EntradaAdmin {...c} name="monto" inputMode="numeric" placeholder="$ 500.000" defaultValue={v?.monto} />}
        </CampoAdmin>
        <CampoAdmin id="pago-periodo" label="Periodo" error={estado.errores?.periodoCorte}>
          {(c) => (
            <SelectAdmin {...c} name="periodoCorte" defaultValue={v?.periodoCorte ?? periodos[0]?.valor}>
              {periodos.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
        <CampoAdmin id="pago-nota" label="Nota (opcional)" error={estado.errores?.nota} className="sm:col-span-2">
          {(c) => <EntradaAdmin {...c} name="nota" maxLength={300} defaultValue={v?.nota} />}
        </CampoAdmin>
      </div>
      {estado.errorGeneral ? (
        <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
          {estado.errorGeneral}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-14 font-semibold text-admin-verde-2">
        {estado.mensaje}
      </p>
      <BotonAdmin textoCargando="Registrando…" className="self-start">
        Registrar pago
      </BotonAdmin>
    </form>
  );
}

/** Corrección de un pago vigente (D-15): monto, concepto y/o nota, con motivo obligatorio. */
function FormularioCorregir({ pago, alCerrar }: { pago: PagoComisionAdmin; alCerrar: () => void }) {
  const [estado, despachar] = useActionState(editarPagoComision, INICIAL_EDITAR);
  const [largoMotivo, setLargoMotivo] = useState(0);
  return (
    <form action={despachar} noValidate className="flex flex-col gap-3 rounded-14 bg-admin-fondo p-4 motion-safe:animate-ga-formulario">
      <input type="hidden" name="pagoId" value={pago.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoAdmin id={`ed-monto-${pago.id}`} label="Monto nuevo" error={estado.errores?.monto} ayuda={`Ahora: ${pago.montoTexto}. Vacío = no cambiar.`}>
          {(c) => <EntradaAdmin {...c} name="monto" inputMode="numeric" autoFocus />}
        </CampoAdmin>
        <CampoAdmin id={`ed-concepto-${pago.id}`} label="Concepto nuevo" error={estado.errores?.concepto} ayuda={`Ahora: ${pago.conceptoTexto}.`}>
          {(c) => (
            <SelectAdmin {...c} name="concepto" defaultValue="">
              <option value="">No cambiar</option>
              {CONCEPTOS_COMISION.map((k) => (
                <option key={k} value={k}>
                  {ETIQUETA_CONCEPTO[k]}
                </option>
              ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
        <CampoAdmin id={`ed-nota-${pago.id}`} label="Nota nueva" error={estado.errores?.nota} className="sm:col-span-2">
          {(c) => <EntradaAdmin {...c} name="nota" maxLength={300} />}
        </CampoAdmin>
        <label className="flex min-h-11 items-center gap-2.5 text-14 text-admin-texto-2 sm:col-span-2">
          <input type="checkbox" name="borrarNota" className="h-5 w-5 accent-[var(--ga-admin-verde)]" />
          Borrar la nota
        </label>
        <CampoAdmin
          id={`ed-motivo-${pago.id}`}
          label="Motivo (obligatorio)"
          error={estado.errores?.motivo}
          ayuda={`Entre 5 y 300 caracteres · ${largoMotivo} / ${MAX_MOTIVO}`}
          className="sm:col-span-2"
        >
          {(c) => (
            <EntradaAdmin
              {...c}
              name="motivo"
              maxLength={MAX_MOTIVO}
              required
              onChange={(e) => setLargoMotivo(e.target.value.length)}
            />
          )}
        </CampoAdmin>
      </div>
      {estado.error ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {estado.error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-13 font-semibold text-admin-verde-2">
        {estado.mensaje}
      </p>
      <div className="flex flex-wrap gap-2">
        <BotonAdmin textoCargando="Guardando…">Guardar corrección</BotonAdmin>
        <button type="button" onClick={alCerrar} className="h-11.5 rounded-full px-5 text-14 font-bold text-admin-texto-2 hover:bg-white/[.06]">
          Cerrar
        </button>
      </div>
    </form>
  );
}

/** Anulación de un pago vigente (D-15): motivo obligatorio; el pago no se borra ni suma. */
function FormularioAnular({ pago, alCerrar }: { pago: PagoComisionAdmin; alCerrar: () => void }) {
  const [estado, despachar] = useActionState(anularPagoComision, INICIAL_ANULAR);
  const [largoMotivo, setLargoMotivo] = useState(0);
  return (
    <form
      action={despachar}
      noValidate
      className="flex flex-col gap-3 rounded-14 bg-admin-fondo p-4 shadow-[inset_0_0_0_1px_var(--ga-admin-rojo-fondo)] motion-safe:animate-ga-formulario"
    >
      <input type="hidden" name="pagoId" value={pago.id} />
      <CampoAdmin
        id={`an-motivo-${pago.id}`}
        label="Motivo de la anulación (obligatorio)"
        error={estado.errores?.motivo}
        ayuda={`El pago deja de sumar en el acumulado del asesor y queda en la bitácora. No se puede deshacer ni corregir después. Entre 5 y 300 caracteres · ${largoMotivo} / ${MAX_MOTIVO}`}
      >
        {(c) => (
          <EntradaAdmin
            {...c}
            name="motivo"
            maxLength={MAX_MOTIVO}
            required
            autoFocus
            onChange={(e) => setLargoMotivo(e.target.value.length)}
          />
        )}
      </CampoAdmin>
      {estado.error ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {estado.error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-13 font-semibold text-admin-verde-2">
        {estado.mensaje}
      </p>
      <div className="flex flex-wrap gap-2">
        <BotonAdmin variante="rojo" textoCargando="Anulando…">
          Anular pago
        </BotonAdmin>
        <button type="button" onClick={alCerrar} className="h-11.5 rounded-full px-5 text-14 font-bold text-admin-texto-2 hover:bg-white/[.06]">
          Cerrar
        </button>
      </div>
    </form>
  );
}

function FilaPago({ pago, alVerHistorial }: { pago: PagoComisionAdmin; alVerHistorial: (pagoId: string) => void }) {
  const [modo, setModo] = useState<"corregir" | "anular" | null>(null);
  return (
    <li className="flex flex-col gap-2.5 rounded-14 bg-admin-superficie-2 p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className={"flex flex-col " + (pago.anulado ? "opacity-75" : "")}>
          <span className="flex flex-wrap items-center gap-2 text-15 font-extrabold text-white">
            <span className={pago.anulado ? "line-through" : ""}>
              {pago.asesorNombre} · {pago.montoTexto}
            </span>
            {pago.anulado ? (
              <span className="rounded-full bg-admin-rojo-fondo px-2.5 py-0.5 text-12 font-extrabold text-admin-rojo-2">Anulado</span>
            ) : null}
          </span>
          <span className="text-13 text-admin-texto-3">
            {pago.conceptoTexto} · corte {pago.periodoTexto}
            {pago.asociadoNombre ? ` · ${pago.asociadoNombre}` : ""}
          </span>
          {pago.nota ? <span className="text-13 text-admin-texto-2">Nota: {pago.nota}</span> : null}
          <span className="text-12 text-admin-texto-3">
            Registró {pago.registradoPor ?? "—"} · {pago.registrado}
          </span>
          {pago.anulado ? (
            <span className="text-13 text-admin-rojo-2">
              Anulado por {pago.anuladoPor ?? "—"} · {pago.anuladoEl}. Motivo: {pago.motivoAnulacion}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Pieza 3o: «Historial» en cada pago (también en los anulados): filtra la bitácora a ese pago. */}
          <button
            type="button"
            aria-label={`Historial del pago de ${pago.asesorNombre} por ${pago.montoTexto}`}
            onClick={() => alVerHistorial(pago.id)}
            className={CLASE_BOTON_BORDE}
          >
            Historial
          </button>
          {!pago.anulado ? (
            <>
              <button
                type="button"
                aria-expanded={modo === "corregir"}
                onClick={() => setModo(modo === "corregir" ? null : "corregir")}
                className={CLASE_BOTON_BORDE}
              >
                Corregir
              </button>
              <button
                type="button"
                aria-expanded={modo === "anular"}
                onClick={() => setModo(modo === "anular" ? null : "anular")}
                className="h-11 rounded-full px-4 text-13 font-bold text-admin-rojo shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)] hover:bg-admin-rojo-fondo"
              >
                Anular
              </button>
            </>
          ) : null}
        </div>
      </div>
      {modo === "corregir" ? <FormularioCorregir pago={pago} alCerrar={() => setModo(null)} /> : null}
      {modo === "anular" ? <FormularioAnular pago={pago} alCerrar={() => setModo(null)} /> : null}
    </li>
  );
}

/**
 * RS-16: acumulado del propio admin que atiende asociados. Oculto («•••••») hasta
 * tocar el botón; revelarlo usa `revelarAcumulado` (suma al contador de la base,
 * que nadie ve en la app). Nunca llega la cifra en las props de la página.
 */
function MiAcumulado() {
  const [total, setTotal] = useState<string | null>(null);
  const [revelado, setRevelado] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [cargando, iniciar] = useTransition();

  function alternar() {
    if (revelado) {
      setRevelado(false);
      return;
    }
    setError(undefined);
    iniciar(async () => {
      const resultado = await revelarAcumulado();
      if (resultado.total) {
        setTotal(resultado.total);
        setRevelado(true);
      } else {
        setError(resultado.error ?? "No pudimos mostrar tu acumulado. Intenta de nuevo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={alternar}
        aria-pressed={revelado}
        disabled={cargando}
        className={`flex items-center gap-2 self-start ${CLASE_BOTON_BORDE} disabled:opacity-85`}
      >
        <span>Mi acumulado ganado</span>
        <span aria-live="polite" className="tabular-nums">
          {revelado && total ? total : "•••••"}
        </span>
      </button>
      {error ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Lista de pagos registrados con «Corregir» y «Anular» (D-15) y su bitácora. */
export function ListaPagosComision({
  pagos,
  totalPorAsesor,
  bitacora,
  mostrarMiAcumulado = false,
}: {
  pagos: PagoComisionAdmin[];
  totalPorAsesor: Record<string, string>;
  bitacora: EntradaBitacoraPago[];
  /** El admin en sesión atiende asociados: su acumulado va oculto (RS-16). */
  mostrarMiAcumulado?: boolean;
}) {
  const [verBitacora, setVerBitacora] = useState(false);
  /** Pago al que se filtra la bitácora («Este pago»); null = «Todos los pagos». El filtro es en el cliente. */
  const [pagoFiltrado, setPagoFiltrado] = useState<string | null>(null);
  const pagoDelFiltro = pagoFiltrado ? pagos.find((p) => p.id === pagoFiltrado) : undefined;
  const entradas = pagoFiltrado ? bitacora.filter((b) => b.pagoId === pagoFiltrado) : bitacora;
  const asesores = Object.entries(totalPorAsesor);
  return (
    <section className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 font-display text-20 font-extrabold">Pagos de comisión</h2>
        <button
          type="button"
          aria-expanded={verBitacora}
          onClick={() => {
            setVerBitacora((x) => !x);
            setPagoFiltrado(null);
          }}
          className={CLASE_BOTON_BORDE}
        >
          {verBitacora ? "Ocultar bitácora" : "Ver bitácora"}
        </button>
      </div>
      {mostrarMiAcumulado ? <MiAcumulado /> : null}
      {asesores.length > 0 ? (
        <p className="m-0 text-13 text-admin-texto-3">
          Suman solo los pagos vigentes (los anulados no cuentan).{" "}
          {pagos
            .filter((p, i, a) => a.findIndex((q) => q.asesorId === p.asesorId) === i)
            .map((p) => `${p.asesorNombre}: ${totalPorAsesor[p.asesorId] ?? "$ 0"}`)
            .join(" · ")}
        </p>
      ) : null}
      {pagos.length === 0 ? (
        <p className="m-0 text-15 text-admin-texto-3">Todavía no hay pagos registrados.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {pagos.map((p) => (
            <FilaPago
              key={p.id}
              pago={p}
              alVerHistorial={(id) => {
                setPagoFiltrado(id);
                setVerBitacora(true);
              }}
            />
          ))}
        </ul>
      )}
      {verBitacora ? (
        <div className="flex flex-col gap-2.5 pt-2 motion-safe:animate-ga-lista">
          <h3 className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
            Bitácora de pagos
            {pagoDelFiltro ? ` · ${pagoDelFiltro.asesorNombre} · ${pagoDelFiltro.montoTexto}` : ""}
          </h3>
          {pagoFiltrado ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed="true" className={`${CLASE_BOTON_BORDE} bg-admin-verde-fondo text-admin-verde-2`}>
                Este pago
              </button>
              <button type="button" aria-pressed="false" onClick={() => setPagoFiltrado(null)} className={CLASE_BOTON_BORDE}>
                Todos los pagos
              </button>
            </div>
          ) : null}
          {entradas.length === 0 ? (
            <p className="m-0 text-14 text-admin-texto-3">Todavía no hay movimientos.</p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {entradas.map((b) => (
                <li key={b.id} className="flex flex-col gap-1 rounded-12 bg-admin-superficie-2 p-3 text-14 leading-140">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-12 font-extrabold ${CLASE_CHIP_ACCION[b.accion]}`}>
                      {b.accionTexto}
                    </span>
                    <span className="font-bold text-admin-texto">{b.actorNombre ?? "Administrador"}</span>
                    <span className="text-13 text-admin-texto-3">{b.cuando}</span>
                  </span>
                  {b.cambios.map(cambioLegible).map((c) => (
                    <span key={c.campo} className="text-admin-texto-2">
                      {c.campo}: <s className="text-admin-texto-3">{c.antes ?? "—"}</s> →{" "}
                      <b className="text-white">{c.despues ?? "—"}</b>
                    </span>
                  ))}
                  {b.motivo ? <span className="text-admin-texto-3">Motivo: {b.motivo}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
