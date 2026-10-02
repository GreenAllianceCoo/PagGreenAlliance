"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CamposSolicitud, type PaqueteCampos } from "@/components/cuenta/CamposSolicitud";
import { crearSolicitud, type EstadoSolicitud } from "./actions";

type Paquete = PaqueteCampos;

const initialState: EstadoSolicitud = {};

/**
 * Formulario de solicitud de crédito: porcentaje de devolución (50 / 100),
 * monto (mínimo $100.000, máximo el tope del grado) y el plazo del grado.
 * Los campos se dibujan con `CamposSolicitud` (los mismos de la cuenta demo);
 * la acción vuelve a validar todo en el servidor.
 */
export default function SolicitudForm({
  paquetes,
  gradoNombre,
}: {
  paquetes: Paquete[];
  gradoNombre: string;
}) {
  // Pieza 3t: no hay porcentaje elegido de entrada; «Enviar solicitud» queda apagado hasta elegirlo.
  const [porcentaje, setPorcentaje] = useState<"" | "50" | "100">("");
  const paquete =
    paquetes.find((p) => p.porcentaje === porcentaje) ?? paquetes[0];
  const [monto, setMonto] = useState(paquete.capacidad_maxima);
  const [state, formAction, pending] = useActionState(
    crearSolicitud,
    initialState,
  );
  const refErrorGeneral = useRef<HTMLParagraphElement>(null);

  const errorPorcentaje =
    state.campo === "porcentaje" ? state.error : undefined;
  const errorMonto = state.campo === "monto" ? state.error : undefined;
  const errorGeneral = state.error && !state.campo ? state.error : undefined;

  // Foco al campo con error (o al mensaje general) después de cada respuesta.
  useEffect(() => {
    if (!state.error) return;
    if (state.campo === "porcentaje") {
      document
        .querySelector<HTMLInputElement>(
          'input[name="porcentaje"]:checked, input[name="porcentaje"]',
        )
        ?.focus();
    } else if (state.campo === "monto") {
      document.getElementById("monto")?.focus();
    } else {
      refErrorGeneral.current?.focus();
    }
  }, [state]);

  function seleccionarPorcentaje(nuevo: Paquete) {
    setPorcentaje(nuevo.porcentaje);
    setMonto(nuevo.capacidad_maxima);
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <CamposSolicitud
        paquetes={paquetes}
        gradoNombre={gradoNombre}
        porcentaje={porcentaje}
        monto={monto}
        onPorcentaje={seleccionarPorcentaje}
        onMonto={setMonto}
        errorPorcentaje={errorPorcentaje}
        errorMonto={errorMonto}
      />

      {errorGeneral ? (
        <p
          ref={refErrorGeneral}
          tabIndex={-1}
          role="alert"
          className="m-0 text-14 font-semibold text-ga-error outline-none"
        >
          {errorGeneral}
        </p>
      ) : null}

      <Button
        disabled={porcentaje === ""}
        cargando={pending}
        textoCargando="Enviando…"
        className="lg:self-start lg:px-9"
      >
        Enviar solicitud
      </Button>
    </form>
  );
}
