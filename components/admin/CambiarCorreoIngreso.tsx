"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { cambiarCorreoIngreso, type EstadoCambiarCorreoIngreso } from "@/app/admin/asociados/actions";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { BotonEnviar } from "./BotonEnviar";

const INICIAL: EstadoCambiarCorreoIngreso = {};

type Props = {
  asociadoId: string;
  nombre: string;
  /** Correo que pidió la persona en /ingresar/recuperar (se propone, el admin puede cambiarlo). */
  correoSugerido?: string;
  /** RS-01: el admin no cambia su propio correo ni el de sus clientes desde aquí. */
  bloqueado?: boolean;
  /** SEC-REC-01: el celular escrito no coincide con el del perfil → el admin debe confirmar que verificó por el del perfil. */
  exigeConfirmarCelular?: boolean;
  onResuelto?: (mensaje: string) => void;
};

/**
 * «Cambiar correo de ingreso» (recuperación de acceso): modal con el correo
 * nuevo y el motivo obligatorio (5 a 300; queda en el historial). Foco al primer
 * campo con error. Solo admin: la Server Action lo vuelve a exigir.
 */
export function CambiarCorreoIngreso({ asociadoId, nombre, correoSugerido, bloqueado = false, exigeConfirmarCelular = false, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(cambiarCorreoIngreso, INICIAL);
  const uid = useId();
  const tituloId = `cambiar-correo-${uid}`;

  useEffect(() => {
    if (estado.mensaje) onResuelto?.(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  useEffect(() => {
    if (estado.errores?.correo) document.getElementById(`${tituloId}-correo`)?.focus();
    else if (estado.errores?.confirmaCelular) document.getElementById(`${tituloId}-confirma`)?.focus();
    else if (estado.errores?.motivo || estado.error) document.getElementById(`${tituloId}-motivo`)?.focus();
  }, [estado, tituloId]);

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => setAbierto(true)}
        className="flex h-11.5 items-center justify-center self-start rounded-full bg-admin-verde px-6 text-14 font-extrabold text-admin-fondo disabled:opacity-60"
      >
        Cambiar correo de ingreso
      </button>
      {estado.mensaje ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
          {estado.mensaje}
        </p>
      ) : null}

      <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
        <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
          <input type="hidden" name="asociadoId" value={asociadoId} />
          <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
            Cambiar el correo de ingreso de {nombre}
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            Hazlo solo después de verificar su identidad por otro medio. Avisaremos al correo anterior y al nuevo, y el
            motivo queda en el historial.
          </p>
          <Field id={`${tituloId}-correo`} label="Correo nuevo" error={estado.errores?.correo}>
            {(control) => (
              <Input
                {...control}
               
                name="correo"
                type="email"
                autoComplete="off"
                defaultValue={correoSugerido}
              />
            )}
          </Field>
          <Field
            id={`${tituloId}-motivo`}
            label="Motivo"
            ayuda="Obligatorio · 5 a 300 caracteres"
            error={estado.errores?.motivo ?? estado.error}
          >
            {(control) => <Textarea {...control} name="motivo" rows={3} maxLength={300} />}
          </Field>
          {exigeConfirmarCelular ? (
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2.5 text-14 font-bold">
                <input
                  id={`${tituloId}-confirma`}
                  type="checkbox"
                  name="confirmaCelular"
                  aria-describedby={estado.errores?.confirmaCelular ? `${tituloId}-confirma-error` : undefined}
                  className="mt-0.5 h-4 w-4 accent-[var(--ga-admin-verde)]"
                />
                El celular que escribió NO coincide con el de su perfil. Verifiqué su identidad por el celular del perfil
                (no por el número escrito en la solicitud).
              </label>
              {estado.errores?.confirmaCelular ? (
                <p id={`${tituloId}-confirma-error`} role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
                  {estado.errores.confirmaCelular}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
            >
              Cancelar
            </button>
            <BotonEnviar textoCargando="Guardando…">Cambiar correo</BotonEnviar>
          </div>
        </form>
      </Modal>
    </div>
  );
}
