"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  confirmarEliminacionAsociado,
  pedirEliminacionAsociado,
  type EstadoConfirmarEliminacion,
  type EstadoPedirEliminacion,
} from "@/app/admin/asociados/eliminar-actions";
import { Modal } from "@/components/ui/Modal";
import { BotonEnviar } from "./BotonEnviar";

const INICIAL_PEDIR: EstadoPedirEliminacion = {};
const INICIAL_CONFIRMAR: EstadoConfirmarEliminacion = {};
const CLASE_AREA =
  "min-h-24 w-full resize-none rounded-12 bg-ga-fondo-suave p-3 text-16 leading-140 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";
const CLASE_CODIGO =
  "h-13 w-full rounded-12 bg-ga-fondo-suave px-3.5 text-center font-mono text-22 font-bold tracking-[0.4em] text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";

type Props = {
  asociadoId: string;
  nombre: string;
  /** Debe estar dado de baja primero. */
  activo: boolean;
  /** Es la propia persona que mira: nadie se elimina a sí mismo. */
  esPropio: boolean;
};

/**
 * «Eliminar definitivamente» (pedido de Sebas, 1-oct): ANONIMIZA al asociado
 * (se conservan las cifras como «Asociado eliminado»). Dos pasos en un diálogo:
 *  1. advertencia clara + motivo obligatorio + casilla «entiendo» → código al correo del admin;
 *  2. código de 6 números (10 minutos, 3 intentos) → «Eliminar definitivamente».
 * Solo admin; la base y el servidor vuelven a validar todo. Tokens y piezas
 * existentes (Modal, BotonEnviar): sin estilos nuevos.
 */
export function EliminarAsociado({ asociadoId, nombre, activo, esPropio }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [ronda, setRonda] = useState(0);
  const [hecho, setHecho] = useState(false);
  const tituloId = `eliminar-titulo-${asociadoId}`;
  const bloqueado = activo || esPropio;

  return (
    <div className="flex flex-col gap-2.5">
      {esPropio ? (
        <p className="m-0 text-14 text-admin-texto-2">No puedes eliminarte a ti mismo; debe hacerlo otro administrador.</p>
      ) : activo ? (
        <p className="m-0 text-14 text-admin-texto-2">
          Para eliminar definitivamente a esta persona primero dala de baja. Es un paso aparte, con su propio motivo.
        </p>
      ) : (
        <p className="m-0 text-14 leading-145 text-admin-texto-2">
          Borra sus datos personales (nombre, cédula, celular, correos, cuenta de nómina, Nequi, fotos, carné y acceso). Sus
          créditos, pagos y comisiones se conservan como «Asociado eliminado». No se puede deshacer.
        </p>
      )}
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => setAbierto(true)}
        className="flex h-11.5 items-center justify-center self-start rounded-full px-6 text-14 font-extrabold text-admin-rojo shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)] disabled:opacity-60"
      >
        Eliminar definitivamente
      </button>

      <Modal abierto={abierto} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
        {hecho ? (
          <div className="flex flex-col gap-4 text-ga-texto">
            <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
              Asociado eliminado
            </h2>
            <p role="status" className="m-0 text-15 leading-150 text-ga-texto-2">
              Los datos personales de {nombre} se borraron. Sus cifras quedan como «Asociado eliminado».
            </p>
            <Link
              href="/admin/asociados"
              className="flex h-11.5 items-center justify-center self-end rounded-full bg-ga-verde px-6 text-15 font-extrabold text-white no-underline"
            >
              Volver a asociados
            </Link>
          </div>
        ) : (
          <Pasos
            key={ronda}
            asociadoId={asociadoId}
            nombre={nombre}
            tituloId={tituloId}
            onCerrar={() => setAbierto(false)}
            onReiniciar={() => setRonda((r) => r + 1)}
            onHecho={() => setHecho(true)}
          />
        )}
      </Modal>
    </div>
  );
}

function Pasos({
  asociadoId,
  nombre,
  tituloId,
  onCerrar,
  onReiniciar,
  onHecho,
}: {
  asociadoId: string;
  nombre: string;
  tituloId: string;
  onCerrar: () => void;
  onReiniciar: () => void;
  onHecho: () => void;
}) {
  const [pedido, pedir] = useActionState(pedirEliminacionAsociado, INICIAL_PEDIR);
  const [confirmacion, confirmar] = useActionState(confirmarEliminacionAsociado, INICIAL_CONFIRMAR);
  const [motivo, setMotivo] = useState("");
  // Controlados: React 19 vacía los campos no controlados de un <form action> cuando termina la acción.
  const [entiendo, setEntiendo] = useState(false);
  const motivoRef = useRef<HTMLTextAreaElement>(null);
  const entiendoRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirmacion.mensaje) onHecho();
  }, [confirmacion.mensaje, onHecho]);

  // Foco al primer campo con error.
  useEffect(() => {
    if (pedido.errores?.motivo) motivoRef.current?.focus();
    else if (pedido.errores?.entiendo) entiendoRef.current?.focus();
  }, [pedido]);
  useEffect(() => {
    if (confirmacion.errores?.codigo) codigoRef.current?.focus();
  }, [confirmacion]);

  const errorMotivo = pedido.errores?.motivo;
  const errorEntiendo = pedido.errores?.entiendo;

  // Paso 2: ya hay código enviado.
  if (pedido.solicitudId) {
    const errorCodigo = confirmacion.errores?.codigo;
    const sinCodigo = Boolean(confirmacion.reiniciar);
    const limpieza = Boolean(confirmacion.limpiezaPendiente);
    return (
      <form action={confirmar} noValidate className="flex flex-col gap-4 text-ga-texto">
        <input type="hidden" name="asociadoId" value={asociadoId} />
        <input type="hidden" name="solicitudId" value={pedido.solicitudId} />
        {limpieza ? <input type="hidden" name="reintento" value="1" /> : null}
        <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
          Escribe el código para eliminar a {nombre}
        </h2>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          Te enviamos un código de 6 números a <strong>{pedido.correoMascara}</strong>. Vence en 10 minutos y tienes 3
          intentos. Después de confirmar no se puede deshacer.
        </p>
        {limpieza ? null : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${tituloId}-codigo`} className="text-14 font-bold">
              Código de 6 números
            </label>
            <input
              ref={codigoRef}
              id={`${tituloId}-codigo`}
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              disabled={sinCodigo}
              aria-invalid={errorCodigo ? true : undefined}
              aria-describedby={errorCodigo ? `${tituloId}-codigo-error` : undefined}
              className={CLASE_CODIGO}
            />
            {errorCodigo ? (
              <span id={`${tituloId}-codigo-error`} role="alert" className="text-13 font-semibold text-ga-error">
                {errorCodigo}
              </span>
            ) : null}
          </div>
        )}
        {confirmacion.error ? (
          <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
            {confirmacion.error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
          >
            Cancelar
          </button>
          {sinCodigo ? (
            <button
              type="button"
              onClick={onReiniciar}
              className="flex h-11.5 items-center justify-center rounded-full bg-ga-verde px-6 text-15 font-extrabold text-white"
            >
              Pedir un código nuevo
            </button>
          ) : (
            <BotonEnviar textoCargando="Eliminando…">{limpieza ? "Reintentar" : "Eliminar definitivamente"}</BotonEnviar>
          )}
        </div>
      </form>
    );
  }

  // Paso 1: advertencia + motivo + casilla.
  return (
    <form action={pedir} noValidate className="flex flex-col gap-4 text-ga-texto">
      <input type="hidden" name="asociadoId" value={asociadoId} />
      <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
        ¿Eliminar definitivamente a {nombre}?
      </h2>
      <div role="note" className="rounded-14 bg-ga-error-fondo p-3.5 text-14 leading-150 text-ga-error-texto">
        <strong>Esto no se puede deshacer.</strong> Se borrarán su nombre, cédula, celular, correos, cuenta de nómina y Nequi, las
        fotos de su afiliación, su carné y su acceso a la cuenta. Sus créditos, pagos y comisiones se conservan, ligados a un
        registro anónimo «Asociado eliminado».
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${tituloId}-motivo`} className="text-14 font-bold">
          Motivo <span className="font-medium text-ga-texto-3">(obligatorio · 5 a 300 caracteres · sin datos personales)</span>
        </label>
        <textarea
          ref={motivoRef}
          id={`${tituloId}-motivo`}
          name="motivo"
          rows={3}
          required
          maxLength={300}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          aria-invalid={errorMotivo ? true : undefined}
          aria-describedby={errorMotivo ? `${tituloId}-motivo-error` : undefined}
          className={CLASE_AREA}
        />
        {errorMotivo ? (
          <span id={`${tituloId}-motivo-error`} role="alert" className="text-13 font-semibold text-ga-error">
            {errorMotivo}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex items-start gap-2.5 text-14 leading-145">
          <input
            ref={entiendoRef}
            type="checkbox"
            name="entiendo"
            checked={entiendo}
            onChange={(e) => setEntiendo(e.target.checked)}
            aria-invalid={errorEntiendo ? true : undefined}
            aria-describedby={errorEntiendo ? `${tituloId}-entiendo-error` : undefined}
            className="mt-0.5 h-5 w-5 flex-none accent-[var(--ga-verde)]"
          />
          <span>Entiendo que se borrarán sus datos personales y que no se puede deshacer.</span>
        </label>
        {errorEntiendo ? (
          <span id={`${tituloId}-entiendo-error`} role="alert" className="text-13 font-semibold text-ga-error">
            {errorEntiendo}
          </span>
        ) : null}
      </div>
      {pedido.error ? (
        <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
          {pedido.error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCerrar}
          className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
        >
          Cancelar
        </button>
        <BotonEnviar textoCargando="Enviando código…">Enviarme el código</BotonEnviar>
      </div>
    </form>
  );
}
