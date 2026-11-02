"use client";

import { useActionState, useState } from "react";
import { cambiarCedulaAsociado, type EstadoCambiarCedula } from "@/app/admin/asociados/cedula-actions";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";

const VACIO: EstadoCambiarCedula = {};

type Props = {
  asociadoId: string;
  cedulaActual: string;
  /** RS-01: es el propio admin o uno de sus clientes (otro admin debe hacerlo). */
  bloqueado?: boolean;
  /** Aviso de éxito (toast en /admin/creditos; texto en la ficha del asociado). */
  onResuelto?: (mensaje: string) => void;
};

/**
 * «Corregir cédula» (solo admin): en la ficha del crédito (/admin/creditos) y en la
 * del asociado (/admin/asociados/[id]). Pide la cédula nueva y el motivo, con el
 * aviso de que la cédula es con lo que la persona ingresa. La base deja el historial.
 */
export function CorregirCedula({ asociadoId, cedulaActual, bloqueado = false, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (!abierto) {
    return (
      <div className="flex flex-col gap-2">
        {aviso ? (
          <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
            {aviso}
          </p>
        ) : null}
        <button
          type="button"
          disabled={bloqueado}
          title={bloqueado ? "Otro administrador debe corregir esta cédula" : undefined}
          onClick={() => {
            setAviso(null);
            setAbierto(true);
          }}
          className="flex h-11.5 items-center justify-center self-start rounded-full px-5 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06] disabled:opacity-60"
        >
          Corregir cédula
        </button>
      </div>
    );
  }
  // Se monta al abrir: arranca vacío cada vez.
  return (
    <FormularioCedula
      asociadoId={asociadoId}
      cedulaActual={cedulaActual}
      onCancelar={() => setAbierto(false)}
      onGuardado={(mensaje) => {
        setAbierto(false);
        if (onResuelto) onResuelto(mensaje);
        else setAviso(mensaje);
      }}
    />
  );
}

function FormularioCedula({
  asociadoId,
  cedulaActual,
  onCancelar,
  onGuardado,
}: {
  asociadoId: string;
  cedulaActual: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [estado, accion] = useActionState(async (previo: EstadoCambiarCedula, datos: FormData) => {
    const resultado = await cambiarCedulaAsociado(previo, datos);
    if (resultado.mensaje) onGuardado(resultado.mensaje);
    return resultado;
  }, VACIO);
  // Campos controlados: React reinicia los no controlados tras la acción.
  const [cedula, setCedula] = useState("");
  const [motivo, setMotivo] = useState("");
  const prefijo = `cedula-${asociadoId}`;
  const errores = estado.errores ?? {};

  return (
    <form
      action={accion}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-ambar)] motion-safe:animate-ga-aparecer"
    >
      <input type="hidden" name="asociadoId" value={asociadoId} />
      <p role="note" className="m-0 rounded-12 bg-admin-ambar-fondo p-3 text-14 leading-145 text-admin-ambar">
        <strong>La cédula es con lo que la persona ingresa a su cuenta.</strong> Desde que la guardes, solo podrá entrar con la
        nueva. Revísala con su documento antes de guardar.
      </p>
      <p className="m-0 text-14 text-admin-texto-2">
        Cédula actual: <strong className="text-admin-texto">{cedulaActual}</strong>
      </p>
      <CampoAdmin id={`${prefijo}-nueva`} label="Cédula nueva" error={errores.cedula}>
        {(c) => (
          <EntradaAdmin
            {...c}
            name="cedula"
            inputMode="numeric"
            autoComplete="off"
            maxLength={16}
            required
            value={cedula}
            onChange={(e) => setCedula(e.target.value)}
          />
        )}
      </CampoAdmin>
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
          Guardar cédula
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
