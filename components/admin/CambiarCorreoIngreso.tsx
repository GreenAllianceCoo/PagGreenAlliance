"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { cambiarCorreoIngreso, type EstadoCambiarCorreoIngreso } from "@/app/admin/asociados/actions";
import type { FilaRecuperacion } from "@/lib/admin/recuperaciones";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { BotonEnviar } from "./BotonEnviar";
import { CampoAdmin, SelectAdmin } from "./CamposAdmin";

const INICIAL: EstadoCambiarCorreoIngreso = {};

type Props = {
  asociadoId: string;
  nombre: string;
  /** Solicitudes pendientes (H-03: elegir una, no escribir el correo). */
  solicitudes: FilaRecuperacion[];
  /** RS-01: el admin no cambia su propio correo ni el de sus clientes desde aquí. */
  bloqueado?: boolean;
  /** La primera solicitud (se sugiere por defecto). */
  solicitudPrincipal?: FilaRecuperacion | null;
  onResuelto?: (mensaje: string) => void;
};

/**
 * «Cambiar correo de ingreso» (recuperación de acceso, H-03): modal con selector
 * de solicitud elegida (no campo de correo libre), motivo obligatorio (5 a 300).
 * Foco al primer campo con error. Solo admin: la Server Action lo vuelve a exigir.
 */
export function CambiarCorreoIngreso({ asociadoId, nombre, solicitudes, bloqueado = false, solicitudPrincipal, onResuelto }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [solicitudElegida, setSolicitudElegida] = useState(solicitudPrincipal?.id ?? "");
  const [estado, accion] = useActionState(cambiarCorreoIngreso, INICIAL);
  const uid = useId();
  const tituloId = `cambiar-correo-${uid}`;

  const solicitudActual = solicitudes.find((s) => s.id === solicitudElegida);
  const celularNoCoincide = solicitudActual && !solicitudActual.celularCoincide;

  useEffect(() => {
    if (estado.mensaje) onResuelto?.(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  useEffect(() => {
    if (estado.errores?.solicitudId) document.getElementById(`${tituloId}-solicitud`)?.focus();
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
          <input type="hidden" name="solicitudId" value={solicitudElegida} />
          <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
            Cambiar el correo de ingreso de {nombre}
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            Elige una solicitud de recuperación. Hazlo solo después de verificar la identidad por otro medio. Avisaremos al
            correo anterior y al nuevo, y el motivo queda en el historial.
          </p>
          <CampoAdmin id={`${tituloId}-solicitud`} label="Solicitud de recuperación" error={estado.errores?.solicitudId}>
            {(c) => (
              <SelectAdmin {...c} value={solicitudElegida} onChange={(e) => setSolicitudElegida(e.target.value)}>
                <option value="">Elige una solicitud</option>
                {solicitudes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.correoNuevo} ({s.creada}, celular {s.celularCoincide ? "coincide" : "NO coincide"})
                  </option>
                ))}
              </SelectAdmin>
            )}
          </CampoAdmin>
          {solicitudActual ? (
            <div className="flex flex-col gap-1.5 rounded-12 bg-admin-ambar-fondo p-3 text-14 text-admin-ambar">
              <p className="m-0 font-bold">Correo nuevo: {solicitudActual.correoNuevo}</p>
              <p className="m-0 text-13">Celular {solicitudActual.celularCoincide ? "coincide" : "NO coincide"}</p>
            </div>
          ) : null}
          <Field
            id={`${tituloId}-motivo`}
            label="Motivo"
            ayuda="Obligatorio · 5 a 300 caracteres"
            error={estado.errores?.motivo ?? estado.error}
          >
            {(control) => <Textarea {...control} name="motivo" rows={3} maxLength={300} />}
          </Field>
          {celularNoCoincide ? (
            <div className="flex flex-col gap-1">
              <label className="flex items-start gap-2.5 text-14 font-bold">
                <input
                  id={`${tituloId}-confirma`}
                  type="checkbox"
                  name="confirmaCelular"
                  aria-describedby={estado.errores?.confirmaCelular ? `${tituloId}-confirma-error` : undefined}
                  className="mt-0.5 h-4 w-4 accent-[var(--ga-admin-verde)]"
                />
                El celular en la solicitud NO coincide con el de su perfil. Verifiqué su identidad por el celular del
                perfil (no por el escrito en la solicitud).
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
