"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { crearAsesor, type EstadoCrearAsesor } from "@/app/admin/asesores/actions";

const VACIO: EstadoCrearAsesor = {};

function CampoAdmin({
  id,
  label,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-14 font-bold">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={
          "h-12 rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] " +
          (error ? "shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]" : "")
        }
        {...props}
      />
      {error ? (
        <span id={`${id}-error`} className="text-12 font-semibold text-admin-rojo-2">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function BotonRegistrar({ rol }: { rol: "asesor" | "secretario" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex h-12 items-center gap-2 self-start rounded-full bg-admin-verde px-7 text-15 font-extrabold text-admin-fondo disabled:opacity-85"
    >
      {pending ? "Creando…" : rol === "secretario" ? "Registrar secretario" : "Registrar asesor"}
    </button>
  );
}

/**
 * «Registrar asesor» (pieza 3f) o «Registrar secretario»: cédula, correo,
 * nombres y apellidos. Con `rol="secretario"` los ids llevan prefijo para no
 * repetirse en la misma página. Cada campo lleva `name` (sin él el navegador
 * no envía el valor y el servidor recibe todo vacío).
 */
export function FormularioAsesor({ rol = "asesor" }: { rol?: "asesor" | "secretario" }) {
  const [estado, accion] = useActionState(crearAsesor, VACIO);
  const pre = rol === "secretario" ? "secretario-" : "";
  const de = rol === "secretario" ? " del secretario" : "";

  useEffect(() => {
    if (estado.errores) {
      const primerCampo = Object.keys(estado.errores)[0];
      if (primerCampo) document.getElementById(pre + primerCampo)?.focus();
    }
  }, [estado, pre]);

  return (
    <form action={accion} noValidate className="flex flex-col gap-4 rounded-20 bg-admin-superficie p-5.5">
      <h2 className="m-0 font-display text-20 font-extrabold">
        {rol === "secretario" ? "Registrar secretario" : "Registrar asesor"}
      </h2>
      <input type="hidden" name="rol" value={rol} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <CampoAdmin
          id={`${pre}cedula`}
          name="cedula"
          label={`Cédula${de}`}
          inputMode="numeric"
          defaultValue={estado.valores?.cedula}
          error={estado.errores?.cedula}
          placeholder="Sin puntos ni espacios"
          required
        />
        <CampoAdmin
          id={`${pre}correo`}
          name="correo"
          label={`Correo${de}`}
          type="email"
          defaultValue={estado.valores?.correo}
          error={estado.errores?.correo}
          placeholder="nombre@correo.com"
          required
        />
        <CampoAdmin
          id={`${pre}nombres`}
          name="nombres"
          label={`Nombres${de}`}
          defaultValue={estado.valores?.nombres}
          error={estado.errores?.nombres}
          required
        />
        <CampoAdmin
          id={`${pre}apellidos`}
          name="apellidos"
          label={`Apellidos${de}`}
          defaultValue={estado.valores?.apellidos}
          error={estado.errores?.apellidos}
          required
        />
      </div>
      {estado.errorGeneral ? (
        <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
          {estado.errorGeneral}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-14 font-semibold text-admin-verde-2">
        {estado.mensaje}
      </p>
      <BotonRegistrar rol={rol} />
    </form>
  );
}
