"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { EstadoBuscarGeneral } from "@/app/asesor/actions";
import { MENSAJE_SIN_RESULTADOS_GENERAL } from "@/lib/asesor/busqueda";

type BuscarAsociadoGeneralProps = {
  /** `buscarAsociadoGeneral` (app/asesor/actions.ts): todos los asociados, solo nombre, cédula enmascarada y asesor. */
  accion: (previo: EstadoBuscarGeneral, formData: FormData) => Promise<EstadoBuscarGeneral>;
};

const ESTADO_INICIAL: EstadoBuscarGeneral = {};

/**
 * «Buscar en toda la cooperativa»: sirve para saber si una persona ya es
 * asociada y de quién es. Muestra solo nombre, cédula enmascarada y asesor
 * (nunca estados, créditos ni datos de contacto). Mínimo 4 caracteres.
 */
export function BuscarAsociadoGeneral({ accion }: BuscarAsociadoGeneralProps) {
  const [estado, despachar, buscando] = useActionState(accion, ESTADO_INICIAL);

  return (
    <section aria-labelledby="buscar-general-titulo" className="flex flex-col gap-3 rounded-20 bg-white p-4.5 lg:rounded-24 lg:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="buscar-general-titulo" className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-20">
          Buscar en toda la cooperativa
        </h2>
        <p className="m-0 text-14 text-ga-texto-2">
          Escribe un nombre o una cédula para ver si ya es asociado y quién lo atiende (mínimo 4 caracteres).
        </p>
      </div>
      <form action={despachar} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field id="buscar-general" label="Nombre o cédula" error={estado.errores?.texto} className="grow">
          {(control) => (
            <Input
              {...control}
              name="texto"
              type="search"
              autoComplete="off"
              maxLength={60}
              placeholder="Ej.: Pérez o 1234567"
              defaultValue={estado.texto}
              className="rounded-full px-5"
            />
          )}
        </Field>
        <Button cargando={buscando} textoCargando="Buscando…" className="sm:mt-[27px] sm:h-13 sm:px-7">
          Buscar
        </Button>
      </form>
      <div aria-live="polite">
        {estado.error ? (
          <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
            {estado.error}
          </p>
        ) : null}
        {estado.resultados && estado.resultados.length === 0 ? (
          <p className="m-0 rounded-12 bg-ga-fondo-suave p-3.5 text-15 text-ga-texto-2">{MENSAJE_SIN_RESULTADOS_GENERAL}</p>
        ) : null}
        {estado.resultados && estado.resultados.length > 0 ? (
          <ul aria-label="Resultados de la búsqueda" className="m-0 flex list-none flex-col gap-2 p-0 motion-safe:animate-ga-lista">
            {estado.resultados.map((r, i) => (
              <li key={`${r.cedulaEnmascarada}-${i}`} className="flex flex-col gap-0.5 rounded-14 bg-ga-fondo-suave px-4 py-3">
                <strong className="text-16 font-extrabold text-ga-navy">{r.nombre}</strong>
                <span className="text-14 text-ga-texto-3">{r.cedulaEnmascarada}</span>
                <span className="text-14 text-ga-texto-2">
                  {r.asesor === "Sin asesor" ? (
                    <strong>Sin asesor</strong>
                  ) : (
                    <>
                      Asesor: <strong>{r.asesor}</strong>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
