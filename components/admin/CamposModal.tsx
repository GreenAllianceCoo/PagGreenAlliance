"use client";

import type { ReactNode } from "react";
import {
  BANCOS,
  BILLETERAS,
  ETIQUETA_OTRA_ENTIDAD,
  esEntidadDeLista,
  NOMBRE_TIPO_CUENTA,
  OPCION_OTRA_ENTIDAD,
  pasosCuentaNomina,
  TIPOS_CUENTA_BANCO,
} from "@/lib/afiliacion/entidades";

/**
 * Piezas compartidas de los formularios en modal claro del panel: «Editar
 * datos» del asociado y «Editar datos de la solicitud» de afiliación.
 */
export const CLASE_CAMPO_MODAL =
  "h-12 w-full min-w-0 rounded-12 bg-ga-fondo-suave px-3.5 text-16 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-error)]";

/** Lo que recibe cada control controlado: name, value y onChange. */
export type PropsControl = { name: string; value: string; onChange: (e: { target: { value: string } }) => void };

export function CampoModal({
  id,
  etiqueta,
  ayuda,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: (p: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const desc = [ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-14 font-bold">
        {etiqueta}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": desc })}
      {ayuda ? (
        <span id={`${id}-ayuda`} className="text-13 text-ga-texto-3">
          {ayuda}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-13 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** Entidad guardada → valor del desplegable («otra» + nombre si no está en la lista). */
export function entidadInicial(entidad: string | null) {
  if (!entidad) return { entidad: "", otra: "" };
  return esEntidadDeLista(entidad) ? { entidad, otra: "" } : { entidad: OPCION_OTRA_ENTIDAD, otra: entidad };
}

/** Cuenta de nómina en cascada: entidad → (nombre si es «Otra») → tipo (bancos) → número. */
export function CamposCuentaNomina({
  idBase,
  control,
  errores,
  opcionVacia,
}: {
  idBase: string;
  control: (nombre: "nomina_entidad" | "nomina_entidad_otra" | "nomina_tipo" | "nomina_numero") => PropsControl;
  errores: Partial<Record<"nomina_entidad" | "nomina_entidad_otra" | "nomina_tipo" | "nomina_numero", string>>;
  /** Texto de la opción vacía de la entidad («Sin cuenta de nómina» / «Elige la entidad»). */
  opcionVacia: string;
}) {
  const pasos = pasosCuentaNomina(control("nomina_entidad").value);
  return (
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
      <legend className="mb-2 p-0 text-14 font-bold">Cuenta de nómina</legend>
      <CampoModal id={`${idBase}-entidad`} etiqueta="Entidad" error={errores.nomina_entidad}>
        {(p) => (
          <select {...p} {...control("nomina_entidad")} className={CLASE_CAMPO_MODAL}>
            <option value="">{opcionVacia}</option>
            <optgroup label="Bancos">
              {BANCOS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </optgroup>
            <optgroup label="Billeteras">
              {BILLETERAS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </optgroup>
            <option value={OPCION_OTRA_ENTIDAD}>{ETIQUETA_OTRA_ENTIDAD}</option>
          </select>
        )}
      </CampoModal>
      {pasos.pideNombreOtra ? (
        <CampoModal id={`${idBase}-otra`} etiqueta="Nombre de la entidad" error={errores.nomina_entidad_otra}>
          {(p) => <input {...p} {...control("nomina_entidad_otra")} maxLength={60} autoComplete="off" className={CLASE_CAMPO_MODAL} />}
        </CampoModal>
      ) : null}
      {pasos.pideTipo ? (
        <CampoModal id={`${idBase}-tipo`} etiqueta="Tipo de cuenta" error={errores.nomina_tipo}>
          {(p) => (
            <select {...p} {...control("nomina_tipo")} className={CLASE_CAMPO_MODAL}>
              <option value="">Elige el tipo</option>
              {TIPOS_CUENTA_BANCO.map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_TIPO_CUENTA[t]}
                </option>
              ))}
            </select>
          )}
        </CampoModal>
      ) : null}
      {pasos.pideNumero ? (
        <CampoModal
          id={`${idBase}-numero`}
          etiqueta={pasos.pideTipo ? "Número de cuenta" : "Número (celular de la billetera)"}
          error={errores.nomina_numero}
        >
          {(p) => (
            <input {...p} {...control("nomina_numero")} inputMode="numeric" maxLength={24} autoComplete="off" className={CLASE_CAMPO_MODAL} />
          )}
        </CampoModal>
      ) : null}
    </fieldset>
  );
}
