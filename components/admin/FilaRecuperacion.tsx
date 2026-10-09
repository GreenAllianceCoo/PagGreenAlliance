"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { rechazarRecuperacion, type EstadoRechazarRecuperacion } from "@/app/admin/alertas/actions";
import type { FilaRecuperacion as Fila } from "@/lib/admin/recuperaciones";
import { Field } from "@/components/ui/Field";
import { IconoWhatsapp } from "@/components/ui/Iconos";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { BotonEnviar } from "./BotonEnviar";
import { CambiarCorreoIngreso } from "./CambiarCorreoIngreso";

const INICIAL: EstadoRechazarRecuperacion = {};

function Rechazar({ solicitudId, nombre }: { solicitudId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState(rechazarRecuperacion, INICIAL);
  const tituloId = `rechazar-recuperacion-${useId()}`;
  useEffect(() => {
    if (estado.errores?.motivo || estado.error) document.getElementById(`${tituloId}-motivo`)?.focus();
  }, [estado, tituloId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11.5 items-center justify-center rounded-full px-5 text-14 font-bold text-admin-rojo shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)] hover:bg-admin-rojo-fondo"
      >
        Rechazar
      </button>
      <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
        <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
          <input type="hidden" name="solicitudId" value={solicitudId} />
          <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
            ¿Rechazar la solicitud de {nombre}?
          </h2>
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            No cambia ningún correo. El motivo queda en el historial y la persona no lo ve.
          </p>
          <Field
            id={`${tituloId}-motivo`}
            label="Motivo"
            ayuda="Obligatorio · 5 a 300 caracteres"
            error={estado.errores?.motivo ?? estado.error}
          >
            {(control) => <Textarea {...control} name="motivo" rows={3} maxLength={300} />}
          </Field>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
            >
              Cancelar
            </button>
            <BotonEnviar textoCargando="Guardando…">Rechazar solicitud</BotonEnviar>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** Fila de «Recuperación de acceso» en /admin/alertas: datos de la solicitud y sus dos acciones. */
export function FilaRecuperacion({ fila }: { fila: Fila }) {
  const pendiente = fila.estado === "pendiente";
  return (
    <div
      data-testid="fila-recuperacion"
      className={
        "flex flex-col gap-3 border-b border-admin-borde-sutil px-5 py-4 last:border-0 " + (pendiente ? "" : "opacity-60")
      }
    >
      <div className="flex flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-15 font-extrabold text-white">
          {fila.nombre}
          <span className="rounded-full bg-admin-ambar-fondo px-2.5 py-0.5 text-12 font-extrabold text-admin-ambar">
            Recuperación de acceso
          </span>
        </span>
        <span className="text-13 text-admin-texto-3">
          C.C. {fila.cedula} · pidió el {fila.creada}
        </span>
        <span className="text-14 text-admin-texto-2">
          Correo nuevo: <b className="text-admin-texto">{fila.correoNuevo}</b>
        </span>
        <span className="text-14 text-admin-texto-2">
          Celular: <b className="text-admin-texto">{fila.celular}</b>{" "}
          {fila.celularCoincide ? (
            <span className="text-admin-verde">· coincide con el de su perfil</span>
          ) : (
            <span className="text-admin-ambar">· NO coincide con el de su perfil</span>
          )}
        </span>
        <span className="text-14 text-admin-texto-2">Motivo: {fila.motivo}</span>
        {!pendiente ? (
          <span className="text-13 text-admin-texto-3">
            {fila.estado === "atendida" ? "Atendida" : "Rechazada"} por {fila.resueltaPor ?? "un administrador"} ·{" "}
            {fila.resuelta}
            {fila.motivoResolucion ? ` · ${fila.motivoResolucion}` : ""}
          </span>
        ) : null}
      </div>
      {pendiente ? (
        <div className="flex flex-wrap items-center gap-2">
          {fila.whatsappUrl ? (
            <a
              href={fila.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-11.5 items-center gap-2 rounded-full px-4 text-14 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
            >
              <IconoWhatsapp tamano={17} />
              Escribir por WhatsApp (celular del perfil)
            </a>
          ) : null}
          <CambiarCorreoIngreso
            asociadoId={fila.perfilId}
            nombre={fila.nombre}
            solicitudes={[fila]}
            bloqueado={fila.bloqueado}
            solicitudPrincipal={fila}
          />
          <Rechazar solicitudId={fila.id} nombre={fila.nombre} />
        </div>
      ) : null}
      {pendiente && !fila.celularCoincide ? (
        <span role="alert" className="text-13 font-bold text-admin-ambar">
          Cuidado: el celular escrito NO es el del perfil. Verifica la identidad solo con el celular del perfil (el botón
          de WhatsApp ya lo usa); no escribas ni llames al número que puso quien pide.
          {fila.whatsappUrl ? "" : " Este perfil no tiene celular guardado: verifica por otro medio de la cooperativa."}
        </span>
      ) : null}
      {pendiente && fila.bloqueado ? (
        <span role="status" className="text-13 font-semibold text-admin-texto-2">
          Esta persona es tuya o de uno de tus clientes: otro administrador debe cambiarle el correo.
        </span>
      ) : null}
    </div>
  );
}
