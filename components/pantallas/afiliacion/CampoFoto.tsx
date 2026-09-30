"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { cx } from "@/components/ui/cx";
import { comprimirFoto } from "@/lib/afiliacion/comprimirFoto";
import { MENSAJE_FOTO_DUDOSA, type ResultadoCalidadFoto } from "@/lib/afiliacion/calidadFoto";
import { AvisoFotoDudosa, SelloCalidadFoto } from "@/components/ui/SelloCalidadFoto";
import { analizarFoto } from "./analizarFoto";

/** `environment` abre la cámara trasera (fotos de la cédula); `user` la delantera (selfie). */
export type CapturaCamara = "environment" | "user";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
/** Mismo límite del bucket privado `afiliacion-documentos` (spec-fase-2 §3). */
const TAMANO_MAXIMO = 5 * 1024 * 1024;
// Compresión: lib/afiliacion/comprimirFoto.ts (~2400 px, calidad 0,85, ≤ ~1,5 MB).
// Las fotos suben directo al bucket con URLs firmadas (spec-requerimientos-ricardo
// §2.10): ya no pasan por la Server Action y no hace falta reducirlas a 300 KB.

type CampoFotoProps = {
  id: string;
  name: string;
  label: string;
  ayuda?: string;
  capture: CapturaCamara;
  /** Error que viene del servidor (se combina con el de validación del propio campo). */
  error?: string;
};

/**
 * Foto obligatoria con vista previa (cédula frente/reverso, selfie). En celular
 * abre la cámara directamente (`accept="image/*"` + `capture`, pedido #7 de la
 * cooperativa). Si la foto pesa más de 5 MB intenta comprimirla en el propio
 * navegador (canvas, sin dependencias) antes de rechazarla.
 */
export function CampoFoto({ id, name, label, ayuda, capture, error }: CampoFotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined);
  // Verificador (pieza 3j): null = sin analizar; solo avisa, nunca bloquea el envío.
  const [calidad, setCalidad] = useState<ResultadoCalidadFoto | null>(null);

  const idAyuda = ayuda ? `${id}-ayuda` : undefined;
  const idError = `${id}-error`;
  const mensajeError = errorLocal ?? error;

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  // React 19 «reinicia» el <form> no controlado tras cada Server Action, y un
  // <input type="file"> no admite volver a ponerle un valor por seguridad del
  // navegador. Si ya teníamos un archivo válido en memoria (p. ej. el usuario
  // corrigió otro campo con error), se lo devolvemos al input con DataTransfer
  // para no pedir que lo vuelvan a elegir.
  useEffect(() => {
    if (archivo && inputRef.current && inputRef.current.files?.length === 0) {
      const datos = new DataTransfer();
      datos.items.add(archivo);
      inputRef.current.files = datos.files;
    }
  });

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setErrorLocal(undefined);

    if (!TIPOS_PERMITIDOS.includes(elegido.type)) {
      setErrorLocal("La foto debe ser JPG, PNG o WEBP.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const final = await comprimirFoto(elegido);
    if (final.size > TAMANO_MAXIMO) {
      setErrorLocal("La foto pesa demasiado (máximo 5 MB).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    if (inputRef.current) {
      const datos = new DataTransfer();
      datos.items.add(final);
      inputRef.current.files = datos.files;
    }
    setArchivo(final);
    setCalidad(null);
    void analizarFoto(final).then(setCalidad);
    setPrevia((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior);
      return URL.createObjectURL(final);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex flex-col gap-1.5">
        <span className="text-15 font-bold">{label}</span>
        <span
          className={cx(
            "relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-12 border-1.5 border-dashed border-ga-borde-input bg-ga-fondo-suave text-14 text-ga-texto-3",
            "transition-colors duration-150",
            mensajeError && "border-ga-error",
          )}
        >
          {previa ? (
            // Vista previa local (URL de tipo blob:), no un asset de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt={`Vista previa: ${label.toLowerCase()}`}
              className="motion-safe:animate-ga-aparecer h-full w-full object-cover"
            />
          ) : (
            <span className="px-3 text-center">Toca para tomar o subir la foto</span>
          )}
          {previa && calidad?.aceptable ? <SelloCalidadFoto /> : null}
        </span>
        {previa ? (
          <span className="self-start text-13 font-bold text-ga-verde">Toca la foto para cambiarla</span>
        ) : null}
      </label>
      {previa && calidad && !calidad.aceptable ? (
        <AvisoFotoDudosa mensaje={MENSAJE_FOTO_DUDOSA} alRepetir={() => inputRef.current?.click()} />
      ) : null}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        capture={capture}
        onChange={alElegir}
        aria-invalid={mensajeError ? true : undefined}
        aria-describedby={[idAyuda, mensajeError ? idError : undefined].filter(Boolean).join(" ") || undefined}
        className="sr-only"
      />
      {ayuda ? (
        <span id={idAyuda} className="text-13 text-ga-texto-3">
          {ayuda}
        </span>
      ) : null}
      {mensajeError ? (
        <span id={idError} className="text-13 font-semibold text-ga-error">
          {mensajeError}
        </span>
      ) : null}
    </div>
  );
}
