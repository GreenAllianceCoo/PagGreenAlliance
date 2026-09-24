"use client";

import { useActionState, useEffect } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { BotonEnviar } from "./BotonEnviar";
import { crearAsesor, type EstadoCrearAsesor } from "@/app/admin/asesores/actions";

const VACIO: EstadoCrearAsesor = {};

/** «Registrar asesor»: cédula, nombres, apellidos y correo. */
export function FormularioAsesor() {
  const [estado, accion] = useActionState(crearAsesor, VACIO);

  useEffect(() => {
    if (estado.errores) {
      const primerCampo = Object.keys(estado.errores)[0];
      if (primerCampo) document.getElementById(primerCampo)?.focus();
    }
  }, [estado]);

  return (
    <form action={accion} noValidate className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:p-7">
      <h2 className="m-0 text-18 font-extrabold">Registrar asesor</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="cedula" label="Cédula" error={estado.errores?.cedula}>
          {(control) => (
            <Input
              {...control}
              name="cedula"
              inputMode="numeric"
              defaultValue={estado.valores?.cedula}
              required
            />
          )}
        </Field>
        <Field id="correo" label="Correo" error={estado.errores?.correo}>
          {(control) => (
            <Input {...control} name="correo" type="email" defaultValue={estado.valores?.correo} required />
          )}
        </Field>
        <Field id="nombres" label="Nombres" error={estado.errores?.nombres}>
          {(control) => <Input {...control} name="nombres" defaultValue={estado.valores?.nombres} required />}
        </Field>
        <Field id="apellidos" label="Apellidos" error={estado.errores?.apellidos}>
          {(control) => <Input {...control} name="apellidos" defaultValue={estado.valores?.apellidos} required />}
        </Field>
      </div>
      {estado.errorGeneral ? (
        <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
          {estado.errorGeneral}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-14 font-semibold text-ga-verde-oscuro">
        {estado.mensaje}
      </p>
      <BotonEnviar textoCargando="Creando…" className="self-start px-7">
        Registrar asesor
      </BotonEnviar>
    </form>
  );
}
