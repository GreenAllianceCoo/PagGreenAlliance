"use client";

import { useActionState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import type { EstadoBuscarCliente } from "@/app/asesor/actions";
import { MENSAJE_CLIENTE_NO_ENCONTRADO, type ClienteBuscado } from "@/lib/asesor/busqueda";
import { ESTADOS_PROCESO } from "@/lib/procesoEjecutivo";

type BuscarClientePorCedulaProps = {
  /** `buscarCliente` (app/asesor/actions.ts): solo sus propios clientes (F2-03). */
  accion: (previo: EstadoBuscarCliente, formData: FormData) => Promise<EstadoBuscarCliente>;
};

const ESTADO_INICIAL: EstadoBuscarCliente = {};

function soloDigitos(evento: ChangeEvent<HTMLInputElement>) {
  evento.target.value = evento.target.value.replace(/[^0-9.\s]/g, "");
}

function DetalleCliente({ cliente }: { cliente: ClienteBuscado }) {
  const paso = cliente.estadoProceso ? ESTADOS_PROCESO.indexOf(cliente.estadoProceso) + 1 : null;
  return (
    <div className="flex flex-col gap-3.5 pt-1 motion-safe:animate-ga-lista">
      {/* TODO(backend: revisión 3j–3n, B2): chip «Afiliación: Aprobada» (pieza 3l, arriba a la derecha).
          buscar_cliente_asesor() no devuelve el estado de la afiliación (solo perfil, proceso y cupos); hay
          que agregar esa columna a la RPC (estado de solicitudes_afiliacion de la cédula) antes de pintarlo.
          No se infiere de «es un perfil»: sería un dato inventado. */}
      <div className="flex flex-col gap-0.5">
        <strong className="font-display text-20 font-extrabold text-ga-navy lg:text-22">{cliente.nombre}</strong>
        <span className="text-14 text-ga-texto-3">
          {[cliente.cedulaEnmascarada, cliente.grado, cliente.institucion].filter(Boolean).join(" · ")}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-13 font-bold uppercase tracking-[0.04em] text-ga-texto-3">
          Estado del proceso ejecutivo
        </span>
        <span className="self-start rounded-full bg-ga-ambar-fondo px-3 py-1.5 text-14 font-extrabold text-ga-ambar-texto">
          {paso ? `${cliente.estadoProcesoTexto} (paso ${paso} de ${ESTADOS_PROCESO.length})` : cliente.estadoProcesoTexto}
        </span>
        {cliente.fechaInicioEmbargoTexto ? (
          <span className="text-13 text-ga-texto-3">Inicio del embargo: {cliente.fechaInicioEmbargoTexto}</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 rounded-16 bg-ga-fondo-suave px-4.5 py-4">
        <span className="text-13 font-bold uppercase tracking-[0.04em] text-ga-texto-3">
          Capacidad de endeudamiento{cliente.grado ? ` · ${cliente.grado}` : ""}
        </span>
        {cliente.capacidad.configurada ? (
          <dl className="m-0 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-13 text-ga-texto-3">50 %</dt>
              <dd className="m-0 text-20 font-extrabold text-ga-navy">{cliente.capacidad.cupo50}</dd>
            </div>
            <div>
              <dt className="text-13 text-ga-texto-3">100 %</dt>
              <dd className="m-0 text-20 font-extrabold text-ga-navy">{cliente.capacidad.cupo100}</dd>
            </div>
          </dl>
        ) : (
          <p className="m-0 text-15 leading-150 text-ga-texto-2">
            {cliente.capacidad.texto}. Tu cliente puede afiliarse, pero todavía no puede pedir crédito.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * «Buscar cliente por cédula» (pieza 3l, spec §5.5): dentro de «Mis clientes». Solo encuentra
 * clientes propios; la cédula del resultado viene enmascarada y nunca se muestra contacto,
 * nómina, fotos ni tasa.
 */
export function BuscarClientePorCedula({ accion }: BuscarClientePorCedulaProps) {
  const [estado, despachar, buscando] = useActionState(accion, ESTADO_INICIAL);

  return (
    <section aria-labelledby="buscar-cedula-titulo" className="flex flex-col gap-3 rounded-20 bg-white p-4.5 lg:rounded-24 lg:p-6">
      <h2 id="buscar-cedula-titulo" className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-20">
        Buscar cliente por cédula
      </h2>
      <form action={despachar} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Field id="buscar-cedula" label="Número de cédula" error={estado.errores?.cedula} className="grow">
          {(control) => (
            <Input
              {...control}
              name="cedula"
              type="search"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Sin puntos ni espacios"
              defaultValue={estado.cedula}
              onChange={soloDigitos}
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
        {estado.cliente === null ? (
          <p className="m-0 rounded-12 bg-ga-fondo-suave p-3.5 text-15 text-ga-texto-2">{MENSAJE_CLIENTE_NO_ENCONTRADO}</p>
        ) : null}
        {estado.cliente ? <DetalleCliente cliente={estado.cliente} /> : null}
      </div>
    </section>
  );
}
