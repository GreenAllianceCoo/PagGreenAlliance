"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";
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
      <div className="grid grid-cols-6 gap-2 lg:gap-2.5">
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
              "h-14.5 min-w-0 rounded-12 border-1.5 bg-white text-center text-24 font-extrabold text-ga-texto lg:h-16 lg:text-26",
              "aria-[invalid=true]:border-ga-error",
              valor ? "border-ga-verde" : "border-ga-borde",
            )}
          />
        ))}
      </div>
      {error ? (
        <span id={idError} className="mt-2.5 text-14 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
