"use client";

import { useActionState, useEffect, useState } from "react";
import { IngresoCodigo } from "@/components/pantallas/IngresoCodigo";
import { LONGITUD_CODIGO, MENSAJE_LIMITE_VERIFICACION } from "@/lib/validaciones/ingreso";
import {
  reenviarCodigoIngreso,
  verificarCodigoIngreso,
  type EstadoIngresoCodigo,
  type EstadoReenvio,
} from "../actions";

const VACIO = Array.from({ length: LONGITUD_CODIGO }, () => "");

function formatoTiempo(segundos: number) {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

type Props = {
  correoEnmascarado: string;
  whatsapp: string;
  whatsappUrl: string | null;
  /** Segundos que faltan para poder reenviar (calculado en el servidor). */
  segundosIniciales: number;
};

/** Conecta /ingresar/codigo con sus dos Server Actions (entrar y reenviar). */
export function FormularioCodigo({ correoEnmascarado, whatsapp, whatsappUrl, segundosIniciales }: Props) {
  const [digitos, setDigitos] = useState<string[]>(VACIO);
  const [restantes, setRestantes] = useState(segundosIniciales);
  // F-02: una vez se supera el tope de intentos, «Entrar» queda deshabilitado
  // (obliga a pedir un código nuevo) hasta que «Reenviar» responda bien. No
  // basta con mirar el error de `estado` porque ese valor no se borra solo:
  // por eso es un estado aparte, que sí se apaga en un reenvío exitoso.
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);

  const [estado, accionEntrar, entrando] = useActionState(
    async (previo: EstadoIngresoCodigo, formData: FormData) => {
      const resultado = await verificarCodigoIngreso(previo, formData);
      // Código equivocado o vencido: casillas vacías para escribirlo de nuevo.
      if (resultado.error) setDigitos(VACIO);
      setLimiteAlcanzado(resultado.error === MENSAJE_LIMITE_VERIFICACION);
      return resultado;
    },
    {},
  );

  const [reenvio, accionReenviar, reenviando] = useActionState<EstadoReenvio>(
    async () => {
      // F-08: el código viejo deja de servir en cuanto se PIDE el reenvío
      // (no cuando el servidor responde, que tarda ≥ 1,5 s a propósito). Si
      // se borrara al terminar, se perdería lo que la persona haya pegado o
      // escrito mientras tanto. Se borra aquí, antes del `await`, así lo que
      // se escriba durante la espera queda intacto.
      setDigitos(VACIO);
      // Código nuevo en camino: se puede volver a intentar.
      setLimiteAlcanzado(false);
      const resultado = await reenviarCodigoIngreso();
      if (typeof resultado.segundos === "number") setRestantes(resultado.segundos);
      return resultado;
    },
    {},
  );

  // Contador de 45 s para «Reenviar código».
  useEffect(() => {
    const id = setInterval(() => setRestantes((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Foco a la primera casilla cuando el código no sirvió.
  useEffect(() => {
    if (estado.error) document.querySelector<HTMLInputElement>('input[name="codigo-1"]')?.focus();
  }, [estado]);

  const completo = digitos.every((d) => /^[0-9]$/.test(d));

  return (
    <IngresoCodigo
      correoEnmascarado={correoEnmascarado}
      whatsapp={whatsapp}
      whatsappUrl={whatsappUrl}
      digitos={digitos}
      onCambioCodigo={setDigitos}
      error={estado.error}
      cargando={entrando}
      accion={accionEntrar}
      accionReenviar={accionReenviar}
      entrarDeshabilitado={!completo || reenviando || limiteAlcanzado}
      reenviarDeshabilitado={restantes > 0 || reenviando || entrando}
      tiempoReenvio={restantes > 0 ? formatoTiempo(restantes) : undefined}
      mensajeEstado={reenviando ? "Enviando un código nuevo…" : reenvio.mensaje}
    />
  );
}
