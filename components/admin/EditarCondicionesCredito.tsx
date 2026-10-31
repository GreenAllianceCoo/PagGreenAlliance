"use client";

import { useActionState, useState } from "react";
import { editarCondicionesCredito, type EstadoEditarCondiciones } from "@/app/admin/creditos/actions";
import { formatearPesos } from "@/lib/cuenta";
import { PLAZO_MAXIMO_MESES, totalSugerido } from "@/lib/credito";
import { leerMontoPesos } from "@/lib/asesor/comisiones";
import { BotonAdmin, CampoAdmin, EntradaAdmin, SelectAdmin } from "./CamposAdmin";

const VACIO: EstadoEditarCondiciones = {};

export type OpcionConvenio = { id: string; nombre: string; visible: boolean };

type Props = {
  solicitudId: string;
  monto: number;
  /** null = todavía sin definir: se propone uno con la tasa del crédito. */
  totalAPagar: number | null;
  plazoMeses: number;
  porcentaje: number;
  tasaMensual: number;
  tipoCredito: "cooperativa" | "convenio";
  convenioId: string | null;
  convenios: OpcionConvenio[];
  onResuelto: (mensaje: string) => void;
};

/**
 * «Editar condiciones» (hasta el desembolso): lo que recibe, lo que devuelve, plazo,
 * porcentaje (entero de 50 a 100) y tipo. La cuota es solo total ÷ meses: no se guarda.
 * El tope no bloquea: el admin puede superarlo con su motivo (queda en el historial).
 */
export function EditarCondicionesCredito({ onResuelto, ...valores }: Props) {
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
  return <FormularioCondiciones {...valores} estado={estado} accion={accion} onCancelar={() => setAbierto(false)} />;
}

/** Campos controlados: React reinicia los no controlados tras la acción, y un error borraría lo escrito. */
function FormularioCondiciones({
  solicitudId,
  monto: montoInicial,
  totalAPagar,
  plazoMeses,
  porcentaje: porcentajeInicial,
  tasaMensual,
  tipoCredito,
  convenioId,
  convenios,
  estado,
  accion,
  onCancelar,
}: Omit<Props, "onResuelto"> & {
  estado: EstadoEditarCondiciones;
  accion: (datos: FormData) => void;
  onCancelar: () => void;
}) {
  const [monto, setMonto] = useState(String(montoInicial));
  const [total, setTotal] = useState(String(totalAPagar ?? totalSugerido(montoInicial, tasaMensual, plazoMeses)));
  const [plazo, setPlazo] = useState(String(plazoMeses));
  const [porcentaje, setPorcentaje] = useState(String(porcentajeInicial));
  const [tipo, setTipo] = useState(tipoCredito);
  const [convenio, setConvenio] = useState(convenioId ?? "");
  const [motivo, setMotivo] = useState("");

  const totalLeido = leerMontoPesos(total);
  const plazoLeido = Number(plazo);
  const cuota =
    totalLeido !== null && totalLeido > 0 && Number.isInteger(plazoLeido) && plazoLeido > 0 ? totalLeido / plazoLeido : null;
  const prefijo = `condiciones-${solicitudId}`;
  const errores = estado.errores ?? {};

  return (
    <form
      action={accion}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
    >
      <input type="hidden" name="id" value={solicitudId} />
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
      {totalAPagar === null ? (
        <p className="m-0 text-13 text-admin-texto-3">El total es una sugerencia con la tasa del crédito: revísalo antes de guardar.</p>
      ) : null}
      {cuota !== null ? (
        <p className="m-0 text-14 text-admin-texto-2">
          Cuota aproximada: <strong className="text-admin-texto">{formatearPesos(cuota)}</strong> al mes
        </p>
      ) : null}
      <CampoAdmin id={`${prefijo}-tipo`} label="Tipo de crédito" error={errores.tipoCredito}>
        {(c) => (
          <SelectAdmin {...c} name="tipoCredito" value={tipo} onChange={(e) => setTipo(e.target.value as Props["tipoCredito"])}>
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
                .filter((o) => o.visible || o.id === convenioId)
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
        label="Motivo del cambio"
        ayuda="Obligatorio. Queda en el historial; el asociado no lo ve."
        error={errores.motivo}
      >
        {(c) => <EntradaAdmin {...c} name="motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </CampoAdmin>
      {estado.error ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{estado.error}</p> : null}
      <div className="flex gap-2.5">
        <BotonAdmin textoCargando="Guardando…" className="h-11.5 flex-1">
          Guardar cambios
        </BotonAdmin>
        <button
          type="button"
          onClick={onCancelar}
          className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
