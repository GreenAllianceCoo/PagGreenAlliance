import { cx } from "./cx";

type OtpInputProps = {
  /** Prefijo del atributo `name` de cada casilla: `codigo-1` … `codigo-6`. */
  name?: string;
  /** Dígitos iniciales (solo para mostrar el diseño). */
  valores?: string[];
  longitud?: number;
  error?: string;
};

/**
 * Seis casillas del código (solo visual). Casilla con dígito = borde verde.
 * TODO(funcionalidad): avance automático, Backspace, pegar 6 dígitos y
 * deshabilitar «Entrar a mi cuenta» hasta completar (docs/mapa-de-botones.md §3).
 */
export function OtpInput({ name = "codigo", valores = [], longitud = 6, error }: OtpInputProps) {
  const idError = error ? `${name}-error` : undefined;
  return (
    <fieldset className="m-0 flex flex-col border-0 p-0" aria-describedby={idError}>
      <legend className="pb-2.5 text-16 font-bold">Código de 6 números</legend>
      <div className="grid grid-cols-6 gap-2 lg:gap-2.5">
        {Array.from({ length: longitud }, (_, i) => {
          const valor = valores[i] ?? "";
          return (
            <input
              key={i}
              name={`${name}-${i + 1}`}
              aria-label={`Número ${i + 1}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              autoComplete={i === 0 ? "one-time-code" : "off"}
              defaultValue={valor}
              aria-invalid={error ? true : undefined}
              className={cx(
                "h-14.5 min-w-0 rounded-12 border-1.5 bg-white text-center text-24 font-extrabold text-ga-texto lg:h-16 lg:text-26",
                "aria-[invalid=true]:border-ga-error",
                valor ? "border-ga-verde" : "border-ga-borde",
              )}
            />
          );
        })}
      </div>
      {error ? (
        <span id={idError} className="mt-2.5 text-14 font-semibold text-ga-error">
          {error}
        </span>
      ) : null}
    </fieldset>
  );
}
