"use client";

import { useActionState, useState, type ReactNode } from "react";
import { editarCondicionesCredito, type EstadoEditarCondiciones } from "@/app/admin/creditos/actions";
import { formatearPesos } from "@/lib/cuenta";
import { PLAZO_MAXIMO_MESES, totalSugerido } from "@/lib/credito";
import { leerMontoPesos } from "@/lib/asesor/comisiones";
import type { CampoEditarCondiciones } from "@/lib/validaciones/admin";
import { BotonAdmin, CampoAdmin, EntradaAdmin, SelectAdmin } from "./CamposAdmin";

const VACIO: EstadoEditarCondiciones = {};

export type OpcionConvenio = { id: string; nombre: string; visible: boolean };
export type TipoCreditoAdmin = "cooperativa" | "convenio";

type Props = {
  solicitudId: string;
  monto: number;
  /** null = todavía sin definir: se propone uno con la tasa del crédito. */
  totalAPagar: number | null;
  plazoMeses: number;
  porcentaje: number;
  tasaMensual: number;
  tipoCredito: TipoCreditoAdmin;
  convenioId: string | null;
  convenios: OpcionConvenio[];
  onResuelto: (mensaje: string) => void;
};

/**
 * «Editar condiciones» (hasta el desembolso): lo que recibe, lo que devuelve, plazo,
 * porcentaje (entero de 50 a 100) y tipo. La cuota es solo total ÷ meses: no se guarda.
 * El tope no bloquea: el admin puede superarlo con su motivo (queda en el historial).
 */
export function EditarCondicionesCredito({ onResuelto, solicitudId, monto, totalAPagar, plazoMeses, porcentaje, tasaMensual, tipoCredito, convenioId, convenios }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(async (previo: EstadoEditarCondiciones, datos: FormData) => {
    const resultado = await editarCondicionesCredito(previo, datos);
    if (resultado.mensaje) {
      onResuelto(resultado.mensaje);
      setAbierto(false);
    }
    return resultado;
  }, VACIO);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11.5 items-center justify-center rounded-full text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
      >
        Editar condiciones
      </button>
    );
  }
  // Se monta al abrir: así siempre arranca con los valores vigentes del crédito.
  return (
    <FormularioCondiciones
      prefijo={`condiciones-${solicitudId}`}
      oculto={{ nombre: "id", valor: solicitudId }}
      inicial={{
        monto: String(monto),
        totalAPagar: String(totalAPagar ?? totalSugerido(monto, tasaMensual, plazoMeses)),
        plazoMeses: String(plazoMeses),
        porcentaje: String(porcentaje),
        tipoCredito,
        convenioId,
      }}
      avisoTotal={totalAPagar === null ? "El total es una sugerencia con la tasa del crédito: revísalo antes de guardar." : null}
      convenios={convenios}
      estado={estado}
      accion={accion}
      onCancelar={() => setAbierto(false)}
    />
  );
}

/** Valores iniciales del formulario, como texto (son campos controlados). */
export type ValoresCondiciones = {
  monto: string;
  totalAPagar: string;
  plazoMeses: string;
  porcentaje: string;
  tipoCredito: TipoCreditoAdmin;
  /** El convenio actual: si está oculto, solo él sigue apareciendo en la lista. */
  convenioId: string | null;
};

/**
 * Formulario de condiciones compartido por «Editar condiciones» y «Nuevo crédito»
 * (components/admin/NuevoCreditoAdmin.tsx). Campos controlados: React reinicia los
 * no controlados tras la acción, y un error borraría lo escrito.
 */
export function FormularioCondiciones({
  prefijo,
  oculto,
  inicial,
  avisoTotal = null,
  sugerirTotal,
  convenios,
  estado,
  accion,
  onCancelar,
  etiquetaMotivo = "Motivo del cambio",
  textoEnviar = "Guardar cambios",
  textoCargando = "Guardando…",
  confirmacion,
}: {
  /** Prefijo de los id de los campos (único en la página). */
  prefijo: string;
  /** Campo oculto que identifica qué se guarda (`id` de la solicitud o `asociadoId`). */
  oculto: { nombre: string; valor: string };
  inicial: ValoresCondiciones;
  /** Aviso bajo los montos (p. ej. «el total es una sugerencia»). */
  avisoTotal?: string | null;
  /** Total sugerido para lo escrito (recibe, plazo y porcentaje); null = sin sugerencia. */
  sugerirTotal?: (monto: number, plazoMeses: number, porcentaje: number) => number | null;
  convenios: OpcionConvenio[];
  estado: { error?: string; errores?: Partial<Record<CampoEditarCondiciones, string>> };
  accion: (datos: FormData) => void;
  onCancelar: () => void;
  etiquetaMotivo?: string;
  textoEnviar?: string;
  textoCargando?: string;
  /** Si viene, «Enviar» primero muestra este resumen y pide confirmar. */
  confirmacion?: (resumen: { monto: number | null; plazoMeses: number; porcentaje: number }) => ReactNode;
}) {
  const [monto, setMonto] = useState(inicial.monto);
  const [total, setTotal] = useState(inicial.totalAPagar);
  const [plazo, setPlazo] = useState(inicial.plazoMeses);
  const [porcentaje, setPorcentaje] = useState(inicial.porcentaje);
  const [tipo, setTipo] = useState(inicial.tipoCredito);
  const [convenio, setConvenio] = useState(inicial.convenioId ?? "");
  const [motivo, setMotivo] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  // Al llegar una respuesta nueva (error o errores por campo) se vuelve a los campos.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    setConfirmando(false);
  }

  const montoLeido = leerMontoPesos(monto);
  const totalLeido = leerMontoPesos(total);
  const plazoLeido = Number(plazo);
  const porcentajeLeido = Number(porcentaje);
  const plazoValido = Number.isInteger(plazoLeido) && plazoLeido > 0;
  const cuota = totalLeido !== null && totalLeido > 0 && plazoValido ? totalLeido / plazoLeido : null;
  const sugerido =
    sugerirTotal && montoLeido !== null && montoLeido > 0 && plazoValido && Number.isInteger(porcentajeLeido)
      ? sugerirTotal(montoLeido, plazoLeido, porcentajeLeido)
      : null;
  const errores = estado.errores ?? {};

  return (
    <form
      action={accion}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
    >
      <input type="hidden" name={oculto.nombre} value={oculto.valor} />
      <div className="grid grid-cols-2 gap-3">
        <CampoAdmin id={`${prefijo}-monto`} label="Recibe (pesos)" error={errores.monto}>
          {(c) => <EntradaAdmin {...c} name="monto" inputMode="numeric" required value={monto} onChange={(e) => setMonto(e.target.value)} />}
        </CampoAdmin>
        <CampoAdmin id={`${prefijo}-total`} label="Devuelve en total (pesos)" error={errores.totalAPagar}>
          {(c) => <EntradaAdmin {...c} name="totalAPagar" inputMode="numeric" required value={total} onChange={(e) => setTotal(e.target.value)} />}
        </CampoAdmin>
        <CampoAdmin id={`${prefijo}-plazo`} label="Plazo (meses)" error={errores.plazoMeses}>
          {(c) => (
            <EntradaAdmin
              {...c}
              name="plazoMeses"
              type="number"
              min={1}
              max={PLAZO_MAXIMO_MESES}
              step={1}
              required
              value={plazo}
              onChange={(e) => setPlazo(e.target.value)}
            />
          )}
        </CampoAdmin>
        <CampoAdmin id={`${prefijo}-porcentaje`} label="Porcentaje (50 a 100)" error={errores.porcentaje}>
          {(c) => <EntradaAdmin {...c} name="porcentaje" type="number" min={50} max={100} step={1} required value={porcentaje} onChange={(e) => setPorcentaje(e.target.value)} />}
        </CampoAdmin>
      </div>
      {avisoTotal ? <p className="m-0 text-13 text-admin-texto-3">{avisoTotal}</p> : null}
      {sugerido !== null ? (
        <p className="m-0 text-13 text-admin-texto-3">
          Total sugerido con la tasa del grado: <strong className="text-admin-texto-2">{formatearPesos(sugerido)}</strong>
        </p>
      ) : null}
      {cuota !== null ? (
        <p className="m-0 text-14 text-admin-texto-2">
          Cuota aproximada: <strong className="text-admin-texto">{formatearPesos(cuota)}</strong> al mes
        </p>
      ) : null}
      <CampoAdmin id={`${prefijo}-tipo`} label="Tipo de crédito" error={errores.tipoCredito}>
        {(c) => (
          <SelectAdmin {...c} name="tipoCredito" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCreditoAdmin)}>
            <option value="cooperativa">Préstamo de la cooperativa</option>
            <option value="convenio">Crédito en un convenio</option>
          </SelectAdmin>
        )}
      </CampoAdmin>
      {tipo === "convenio" ? (
        <CampoAdmin id={`${prefijo}-convenio`} label="Convenio" error={errores.convenioId}>
          {(c) => (
            <SelectAdmin {...c} name="convenioId" required value={convenio} onChange={(e) => setConvenio(e.target.value)}>
              <option value="">Elige el convenio</option>
              {/* Uno oculto solo aparece si ya era el de este crédito (la base aplica la misma regla). */}
              {convenios
                .filter((o) => o.visible || o.id === inicial.convenioId)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
            </SelectAdmin>
          )}
        </CampoAdmin>
      ) : null}
      <CampoAdmin
        id={`${prefijo}-motivo`}
        label={etiquetaMotivo}
        ayuda="Obligatorio. Queda en el historial; el asociado no lo ve."
        error={errores.motivo}
      >
        {(c) => <EntradaAdmin {...c} name="motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </CampoAdmin>
      {estado.error ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{estado.error}</p> : null}
      {confirmacion && confirmando ? (
        <div className="flex flex-col gap-3 rounded-14 bg-admin-superficie p-3.5">
          <div className="text-15 leading-150">
            {confirmacion({ monto: montoLeido, plazoMeses: plazoLeido, porcentaje: porcentajeLeido })}
          </div>
          <div className="flex gap-2.5">
            <BotonAdmin textoCargando={textoCargando} className="h-11.5 flex-1">
              {textoEnviar}
            </BotonAdmin>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
            >
              Volver
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2.5">
          {confirmacion ? (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="flex h-11.5 flex-1 items-center justify-center rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo"
            >
              Revisar y confirmar
            </button>
          ) : (
            <BotonAdmin textoCargando={textoCargando} className="h-11.5 flex-1">
              {textoEnviar}
            </BotonAdmin>
          )}
          <button
            type="button"
            onClick={onCancelar}
            className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
          >
            Cancelar
          </button>
        </div>
      )}
    </form>
  );
}
