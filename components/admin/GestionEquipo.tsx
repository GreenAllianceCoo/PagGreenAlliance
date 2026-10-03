"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cambiarEstadoAsociado, type EstadoCambiarEstadoAsociado } from "@/app/admin/asociados/actions";
import { cambiarRolEquipo, type EstadoCambiarRolEquipo } from "@/app/admin/asesores/actions";
import { Modal } from "@/components/ui/Modal";
import { BotonEnviar } from "./BotonEnviar";

const CLASE_AREA =
  "min-h-24 w-full resize-none rounded-12 bg-ga-fondo-suave p-3 text-16 leading-140 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";
const CLASE_SELECT =
  "h-12 w-full rounded-12 bg-ga-fondo-suave px-3.5 text-16 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";
const CLASE_BOTON_BORDE =
  "flex h-11 items-center justify-center rounded-full px-4 text-13 font-extrabold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06] disabled:opacity-60";

type Rol = "asesor" | "admin" | "secretario";

const ETIQUETA_ROL: Record<Rol, string> = { asesor: "Asesor", admin: "Administrador", secretario: "Secretario" };

/** A qué rol se puede pasar desde cada uno (la base lo vuelve a exigir). */
const DESTINOS: Record<Rol, Rol[]> = { secretario: ["asesor", "admin"], asesor: ["secretario"], admin: [] };

type Props = {
  perfilId: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  /** Es el admin en sesión: nadie cambia su propio rol ni se desactiva. */
  esPropio: boolean;
};

/**
 * Acciones del admin sobre alguien del equipo (decisión de Sebas, 2-oct):
 * «Desactivar» / «Reactivar» (solo secretarios; pierde el acceso con el mismo mecanismo de
 * cuenta inactiva) y «Cambiar rol» (secretario a asesor o admin, asesor a secretario).
 * Ambas con motivo obligatorio (5 a 300) que queda en el historial.
 */
export function GestionEquipo({ perfilId, nombre, rol, activo, esPropio }: Props) {
  const puedeDesactivar = rol === "secretario";
  const destinos = DESTINOS[rol];
  if (esPropio || (!puedeDesactivar && destinos.length === 0)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {puedeDesactivar ? <ModalEstado key={String(activo)} perfilId={perfilId} nombre={nombre} activo={activo} /> : null}
      {destinos.length > 0 ? <ModalRol key={rol} perfilId={perfilId} nombre={nombre} rol={rol} destinos={destinos} /> : null}
    </div>
  );
}

/**
 * Saca el diálogo del <li> de la lista: esa fila se anima con transform (entrada), y un
 * elemento fixed dentro de un ancestro con transform se posiciona respecto a ese ancestro
 * (el diálogo quedaría recortado y encima de la fila, no de la pantalla).
 */
function EnPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function CampoMotivo({
  id,
  valor,
  onCambio,
  error,
}: {
  id: string;
  valor: string;
  onCambio: (v: string) => void;
  error?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Foco al campo con error (accesibilidad).
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-14 font-bold">
        Motivo <span className="font-medium text-ga-texto-3">(obligatorio · 5 a 300 caracteres)</span>
      </label>
      <textarea
        ref={ref}
        id={id}
        name="motivo"
        rows={3}
        required
        maxLength={300}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={CLASE_AREA}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="text-13 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function ModalEstado({ perfilId, nombre, activo }: { perfilId: string; nombre: string; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, accion] = useActionState<EstadoCambiarEstadoAsociado, FormData>(cambiarEstadoAsociado, {});
  const desactivar = activo;
  const tituloId = `equipo-estado-${perfilId}`;
  const error = estado.errores?.motivo ?? estado.error;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={CLASE_BOTON_BORDE}>
        {desactivar ? "Desactivar" : "Reactivar"}
        <span className="sr-only"> a {nombre}</span>
      </button>
      <EnPortal>
        <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
          <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
            <input type="hidden" name="asociadoId" value={perfilId} />
            <input type="hidden" name="activo" value={desactivar ? "false" : "true"} />
            <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
              {desactivar ? `¿Desactivar a ${nombre}?` : `¿Reactivar a ${nombre}?`}
            </h2>
            <p className="m-0 text-15 leading-150 text-ga-texto-2">
              {desactivar
                ? "Perderá el acceso al panel y no podrá ingresar. Puedes reactivarlo después."
                : "Recuperará el acceso al panel."}{" "}
              El motivo queda en el historial.
            </p>
            <CampoMotivo id={`${tituloId}-motivo`} valor={motivo} onCambio={setMotivo} error={error} />
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
              >
                Cancelar
              </button>
              <BotonEnviar textoCargando="Guardando…">{desactivar ? "Desactivar" : "Reactivar"}</BotonEnviar>
            </div>
          </form>
        </Modal>
      </EnPortal>
    </>
  );
}

function ModalRol({ perfilId, nombre, rol, destinos }: { perfilId: string; nombre: string; rol: Rol; destinos: Rol[] }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, accion] = useActionState<EstadoCambiarRolEquipo, FormData>(cambiarRolEquipo, {});
  const tituloId = `equipo-rol-${perfilId}`;
  const errorRol = estado.errores?.rol ?? estado.error;

  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={CLASE_BOTON_BORDE}>
        Cambiar rol
        <span className="sr-only"> de {nombre}</span>
      </button>
      <EnPortal>
        <Modal abierto={abierto && !estado.mensaje} onCerrar={() => setAbierto(false)} tituloId={tituloId} variante="centrado">
          <form action={accion} noValidate className="flex flex-col gap-4 text-ga-texto">
            <input type="hidden" name="perfilId" value={perfilId} />
            <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
              Cambiar el rol de {nombre}
            </h2>
            <p className="m-0 text-15 leading-150 text-ga-texto-2">
              Hoy es {ETIQUETA_ROL[rol].toLowerCase()}. El cambio aplica de inmediato y el motivo queda en el historial.
            </p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${tituloId}-rol`} className="text-14 font-bold">
                Nuevo rol
              </label>
              <select
                id={`${tituloId}-rol`}
                name="rol"
                defaultValue={destinos[0]}
                aria-invalid={errorRol ? true : undefined}
                aria-describedby={errorRol ? `${tituloId}-rol-error` : undefined}
                className={CLASE_SELECT}
              >
                {destinos.map((d) => (
                  <option key={d} value={d}>
                    {ETIQUETA_ROL[d]}
                  </option>
                ))}
              </select>
              {errorRol ? (
                <span id={`${tituloId}-rol-error`} role="alert" className="text-13 font-semibold text-ga-error">
                  {errorRol}
                </span>
              ) : null}
            </div>
            <CampoMotivo id={`${tituloId}-motivo`} valor={motivo} onCambio={setMotivo} error={estado.errores?.motivo} />
            <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
              >
                Cancelar
              </button>
              <BotonEnviar textoCargando="Guardando…">Cambiar rol</BotonEnviar>
            </div>
          </form>
        </Modal>
      </EnPortal>
    </>
  );
}
