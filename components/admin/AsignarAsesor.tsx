"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { asignarAsesor, type EstadoAccionAfiliacion } from "@/app/admin/afiliaciones/actions";
import { IconoCheck } from "@/components/ui/Iconos";

const VACIO: EstadoAccionAfiliacion = {};

export type PerfilAsociadoAsesor = { id: string; asesorNombre: string | null };
export type AsesorDisponible = { id: string; nombre: string };

type Props = {
  solicitudId: string;
  perfilAsociado: PerfilAsociadoAsesor;
  asesores: AsesorDisponible[];
  /** Para el toast del panel (mismo patrón que «Aprobar»/«Rechazar», pieza 2d). */
  onResuelto: (mensaje: string) => void;
};

/**
 * Bloque «Asesor» (pieza 3i, D-09 · P-96 aprobado el 2026-09-27): asigna
 * `perfiles.asesor_id` de un asociado ya aprobado — distinto de «Asesor que
 * refirió» (más arriba en la ficha), que es quien lo refirió antes de
 * afiliarse. El servidor (app/admin/afiliaciones/[id]/page.tsx) ya decide
 * cuándo montar este componente: afiliación aprobada y perfil todavía sin
 * asesor. Sin opción de reasignar ni quitar un asesor ya puesto (regla de
 * Sebas, 2026-09-27): una vez asignado, el bloque pasa a solo lectura.
 */
export function AsignarAsesor({ solicitudId, perfilAsociado, asesores, onResuelto }: Props) {
  const [estado, accion] = useActionState(asignarAsesor, VACIO);
  const [elegidoId, setElegidoId] = useState("");
  // Nombre del asesor recién asignado: el bloque se funde hacia la versión de
  // solo lectura apenas la Server Action responde con éxito, sin esperar a
  // que `revalidatePath` traiga de vuelta `perfilAsociado` actualizado.
  const [asignadoLocal, setAsignadoLocal] = useState<string | null>(perfilAsociado.asesorNombre);
  // Recuerda el último mensaje ya procesado, para no repetir el cálculo de
  // abajo en cada render (patrón oficial de React: «ajustar estado durante
  // el render» en vez de un efecto que solo duplicaría el mismo cambio).
  const [ultimoMensaje, setUltimoMensaje] = useState<string | undefined>(undefined);

  if (estado.mensaje && estado.mensaje !== ultimoMensaje) {
    setUltimoMensaje(estado.mensaje);
    const elegido = asesores.find((a) => a.id === elegidoId);
    if (elegido) setAsignadoLocal(elegido.nombre);
  }

  // El toast sí es un efecto de verdad: avisa a un sistema externo (el
  // padre, que guarda el mensaje en su propio estado para <ToastAdmin>).
  useEffect(() => {
    if (estado.mensaje) onResuelto(estado.mensaje);
  }, [estado.mensaje, onResuelto]);

  // --- Ya asignado (recién, o de entrada si el perfil ya lo traía): solo lectura. ---
  if (asignadoLocal) {
    return (
      <div className="flex flex-col gap-2.5 rounded-16 bg-admin-superficie-2 p-4 animate-ga-asesor-listo">
        <EncabezadoAsesor />
        <div className="flex items-center gap-2 rounded-12 bg-admin-verde-fondo px-3 py-2.5">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-admin-verde text-admin-fondo"
          >
            <IconoCheck tamano={12} grosor={3} />
          </span>
          <span className="text-13 text-admin-verde-claro">
            Asesor asignado: <strong className="text-white">{asignadoLocal}</strong>
          </span>
        </div>
      </div>
    );
  }

  // --- Sin asesores registrados todavía: nada que elegir. ---
  if (asesores.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-16 bg-admin-superficie-2 p-4">
        <EncabezadoAsesor />
        <p className="m-0 text-13 leading-150 text-admin-texto-2">Todavía no hay asesores registrados.</p>
        <Link href="/admin/asesores" className="text-13 font-bold text-admin-verde-2 underline">
          Ir a /admin/asesores
        </Link>
      </div>
    );
  }

  // --- Selector + «Asignar asesor» (sin elegir / asignando / error). ---
  return (
    <div className="flex flex-col gap-2.5 rounded-16 bg-admin-superficie-2 p-4">
      <EncabezadoAsesor />
      <form action={accion} className="flex flex-col gap-2.5">
        <input type="hidden" name="id" value={solicitudId} />
        <SelectorAsesor asesores={asesores} valor={elegidoId} alCambiar={setElegidoId} />
        <BotonAsignar deshabilitado={!elegidoId} />
        {estado.error ? (
          <p role="alert" className="m-0 animate-ga-error-chico text-12 font-semibold text-admin-rojo-2">
            {estado.error}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function EncabezadoAsesor() {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">Asesor</span>
      <span className="text-13 leading-145 text-admin-texto-3">
        Distinto de «Asesor que refirió»: es quien atenderá sus créditos de aquí en adelante.
      </span>
    </div>
  );
}

function SelectorAsesor({
  asesores,
  valor,
  alCambiar,
}: {
  asesores: AsesorDisponible[];
  valor: string;
  alCambiar: (id: string) => void;
}) {
  const { pending } = useFormStatus();
  return (
    <select
      id="asignar-asesor-select"
      name="asesorId"
      required
      disabled={pending}
      aria-label="Elige un asesor"
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      className="h-11.5 rounded-10 bg-admin-fondo px-3.5 text-14 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] disabled:opacity-60"
    >
      <option value="" disabled>
        Elige un asesor
      </option>
      {asesores.map((a) => (
        <option key={a.id} value={a.id}>
          {a.nombre}
        </option>
      ))}
    </select>
  );
}

function BotonAsignar({ deshabilitado }: { deshabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={deshabilitado || pending}
      aria-busy={pending || undefined}
      className={
        "flex h-11.5 items-center justify-center gap-2 rounded-full bg-admin-verde text-14 font-extrabold text-admin-fondo disabled:cursor-not-allowed disabled:opacity-40" +
        (pending ? " opacity-85" : "")
      }
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
          Asignando…
        </>
      ) : (
        "Asignar asesor"
      )}
    </button>
  );
}
