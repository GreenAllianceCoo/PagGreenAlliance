"use client";

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { cx } from "./cx";

type OtpInputProps = {
  /** Prefijo del atributo `name` de cada casilla: `codigo-1` … `codigo-6`. */
  name?: string;
  /** Dígitos actuales (uno por casilla). */
  valores?: string[];
  longitud?: number;
  error?: string;
  /**
   * Con esta función las casillas quedan controladas: avance automático,
   * Backspace vuelve a la anterior, pegar el código llena todas
   * (docs/mapa-de-botones.md §3). Sin ella, solo se muestran `valores`.
   */
  onCambio?: (valores: string[]) => void;
};

/** Seis casillas del código. Casilla con dígito = borde verde. */
export function OtpInput({ name = "codigo", valores = [], longitud = 6, error, onCambio }: OtpInputProps) {
  const idError = error ? `${name}-error` : undefined;
  const casillas = useRef<(HTMLInputElement | null)[]>([]);
  const controlado = typeof onCambio === "function";

  const actuales = Array.from({ length: longitud }, (_, i) => valores[i] ?? "");

  // MOVIMIENTO (pieza 3b): las 6 casillas se sacuden ±6 px, 3 veces, cuando
  // llega un código inválido. Se detecta sin tocar la lógica del formulario:
  // cada intento equivocado hace que el padre limpie las casillas MIENTRAS
  // `error` sigue lleno (mismo render), así que esa combinación («hay error»
  // + «las 6 casillas están vacías») solo aparece cuando hay un intento
  // nuevo (entre uno y otro, la persona vuelve a escribir 6 dígitos). El
  // estado se ajusta durante el render (patrón oficial de React para
  // «adjusting state when a prop changes»: https://react.dev/learn/you-might-not-need-an-effect),
  // no dentro de un useEffect, para no disparar el lint de «setState
  // síncrono en un efecto» ni una vuelta extra de render. Cambiar la `key`
  // del contenedor fuerza a que la animación se reproduzca cada vez, aunque
  // el mensaje de error sea idéntico al del intento anterior. Con
  // movimiento reducido, la regla global de app/globals.css deja la
  // animación en 1 ms: solo se nota el borde rojo, como pide la pieza.
  const señalError = error && actuales.every((d) => d === "") ? error : null;
  const [sacudida, setSacudida] = useState(0);
  const [señalAnterior, setSeñalAnterior] = useState<string | null>(null);
  if (señalError !== señalAnterior) {
    setSeñalAnterior(señalError);
    if (señalError !== null) setSacudida((s) => s + 1);
  }

  function enfocar(i: number) {
    const destino = casillas.current[Math.max(0, Math.min(longitud - 1, i))];
    destino?.focus();
    destino?.select();
  }

  /** Escribe dígitos desde la casilla `desde` (sirve para teclear, autocompletar y pegar). */
  function escribir(desde: number, texto: string) {
    const digitos = texto.replace(/\D/g, "").split("");
    if (digitos.length === 0) return;
    // Si llega el código completo (pegado o autocompletado), llena desde la primera.
    const inicio = digitos.length >= longitud ? 0 : desde;
    const nuevos = [...actuales];
    digitos.slice(0, longitud - inicio).forEach((d, k) => {
      nuevos[inicio + k] = d;
    });
    onCambio?.(nuevos);
    enfocar(Math.min(inicio + digitos.length, longitud - 1));
  }

  function alTeclear(i: number, evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Backspace") {
      evento.preventDefault();
      const nuevos = [...actuales];
      if (nuevos[i]) {
        nuevos[i] = "";
        onCambio?.(nuevos);
      } else if (i > 0) {
        nuevos[i - 1] = "";
        onCambio?.(nuevos);
        enfocar(i - 1);
      }
    } else if (evento.key === "ArrowLeft") {
      evento.preventDefault();
      enfocar(i - 1);
    } else if (evento.key === "ArrowRight") {
      evento.preventDefault();
      enfocar(i + 1);
    }
  }

  function alPegar(i: number, evento: ClipboardEvent<HTMLInputElement>) {
    evento.preventDefault();
    escribir(i, evento.clipboardData.getData("text"));
  }

  return (
    <fieldset className="m-0 flex flex-col border-0 p-0" aria-describedby={idError}>
      <legend className="pb-2.5 text-16 font-bold">Código de 6 números</legend>
      {/* `key`: cambia en cada código inválido para que la sacudida se reproduzca
          de nuevo, aunque el mensaje de error sea el mismo que el intento anterior. */}
      <div
        key={sacudida}
        className={cx("grid grid-cols-6 gap-1.5 lg:gap-2.5", error && "motion-safe:animate-ga-sacude")}
      >
        {actuales.map((valor, i) => (
          <input
            key={i}
            ref={(el) => {
              casillas.current[i] = el;
            }}
            name={`${name}-${i + 1}`}
            aria-label={`Número ${i + 1}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            // La primera casilla acepta el código completo (autocompletar del celular).
            maxLength={i === 0 ? longitud : 1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            {...(controlado
              ? {
                  value: valor,
                  onChange: (e) => {
                    if (e.target.value === "") {
                      const nuevos = [...actuales];
                      nuevos[i] = "";
                      onCambio?.(nuevos);
                    } else {
                      // Uno o varios dígitos (teclear, autocompletar): se reparten desde aquí.
                      escribir(i, e.target.value);
                    }
                  },
                  onKeyDown: (e) => alTeclear(i, e),
                  onPaste: (e) => alPegar(i, e),
                  onFocus: (e) => e.target.select(),
                }
              : { defaultValue: valor })}
            aria-invalid={error ? true : undefined}
            className={cx(
              "h-13 min-w-0 rounded-10 border-1.5 bg-white text-center text-20 font-extrabold text-ga-texto",
              "lg:h-14.5 lg:rounded-12 lg:text-24",
              "transition-[border-color,box-shadow] duration-150",
              "focus:outline-none focus:border-ga-verde focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)]",
              "aria-[invalid=true]:border-ga-error",
              valor ? "border-ga-verde" : "border-ga-borde-input",
            )}
          />
        ))}
      </div>
      {error ? (
        <span id={idError} className="mt-2.5 text-13 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
