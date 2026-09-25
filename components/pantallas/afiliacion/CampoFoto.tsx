"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { cx } from "@/components/ui/cx";

/** `environment` abre la cámara trasera (fotos de la cédula); `user` la delantera (selfie). */
export type CapturaCamara = "environment" | "user";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
/** Mismo límite del bucket privado `afiliacion-documentos` (spec-fase-2 §3). */
const TAMANO_MAXIMO = 5 * 1024 * 1024;
/** Lado más largo tras comprimir, en píxeles: de sobra para leer un documento. */
const LADO_MAXIMO_PX = 1600;
/**
 * S-03 (revisión de seguridad 2026-09-24): con 3 fotos de celular sin
 * comprimir (3-4 MB cada una) el envío completo supera el límite de 4,5 MB
 * de Vercel para Server Actions. Por eso AHORA se comprime SIEMPRE (no solo
 * cuando pesa más de TAMANO_MAXIMO), apuntando a este peso objetivo; junto
 * con `experimental.serverActions.bodySizeLimit` en next.config.mjs, el
 * envío de las 3 fotos queda muy por debajo del límite de Vercel.
 */
const PESO_OBJETIVO = 300 * 1024;

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

    const final = await comprimirSiempre(elegido);
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
            "relative flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-12 border-1.5 border-dashed border-ga-borde bg-ga-fondo-suave text-14 text-ga-texto-3",
            mensajeError && "border-ga-error",
          )}
        >
          {previa ? (
            // Vista previa local (URL de tipo blob:), no un asset de next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previa}
              alt={`Vista previa: ${label.toLowerCase()}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-3 text-center">Toca para tomar o subir la foto</span>
          )}
        </span>
        {previa ? (
          <span className="self-start text-13 font-bold text-ga-verde">Toca la foto para cambiarla</span>
        ) : null}
      </label>
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
        <span id={idError} className="text-14 font-semibold text-ga-error">
          {mensajeError}
        </span>
      ) : null}
    </div>
  );
}

/**
 * S-03: redimensiona SIEMPRE a máx. 1600 px de lado y reconvierte a JPEG,
 * bajando la calidad hasta acercarse a PESO_OBJETIVO (~300 KB) o hasta agotar
 * los intentos. Si por lo que sea el resultado no pesa menos que el original
 * (fotos ya pequeñas), se conserva el original tal cual: nunca se sube algo
 * más pesado de lo que el usuario eligió.
 */
async function comprimirSiempre(archivo: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));
    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) return archivo;
    contexto.drawImage(bitmap, 0, 0, ancho, alto);

    // Baja la calidad JPEG en pasos hasta acercarse al peso objetivo.
    let comprimido: File | null = null;
    for (const calidad of [0.82, 0.7, 0.55, 0.4]) {
      const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", calidad));
      if (!blob) continue;
      const nombre = `${archivo.name.replace(/\.\w+$/, "")}.jpg`;
      comprimido = new File([blob], nombre, { type: "image/jpeg" });
      if (comprimido.size <= PESO_OBJETIVO) break;
    }
    if (!comprimido) return archivo;
    // Si el original ya era más liviano que el resultado (foto ya chica),
    // no tiene sentido "engordarla": se conserva el original.
    return comprimido.size < archivo.size ? comprimido : archivo;
  } catch {
    return archivo;
  }
}
