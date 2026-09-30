"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { cx } from "@/components/ui/cx";
import { AvisoFotoDudosa, SelloCalidadFoto } from "@/components/ui/SelloCalidadFoto";
import { MENSAJE_FOTO_DUDOSA, type ResultadoCalidadFoto } from "@/lib/afiliacion/calidadFoto";
import { comprimirFoto } from "@/lib/afiliacion/comprimirFoto";
import { analizarFoto } from "./analizarFoto";

type Fase = "inicio" | "camara" | "tomada" | "negada";

type CampoSelfieProps = {
  id: string;
  name: string;
  label: string;
  error?: string;
};

const OVALO =
  "h-24 w-20 rounded-[50%_50%_50%_50%/55%_55%_45%_45%] border-2 border-dashed border-white/55";

/**
 * Selfie en el momento (pieza 3j, spec-requerimientos-ricardo §2.10): abre la
 * cámara frontal dentro de la página con `getUserMedia` y «Tomar selfie»
 * captura la imagen (no se elige de la galería). Si el navegador no da
 * permiso, cae al `<input capture="user">` de siempre («Tomar o subir la foto»).
 * El archivo viaja en un <input type="file" name="foto_selfie"> oculto, igual
 * que las otras fotos, así el envío (subida directa a URLs firmadas) no cambia.
 * Las pistas de la cámara se detienen al capturar, al repetir y al desmontar.
 */
export function CampoSelfie({ id, name, label, error }: CampoSelfieProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const flujoRef = useRef<MediaStream | null>(null);
  const [fase, setFase] = useState<Fase>("inicio");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [calidad, setCalidad] = useState<ResultadoCalidadFoto | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [flash, setFlash] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | undefined>(undefined);

  const idError = `${id}-error`;
  const mensajeError = errorLocal ?? error;

  const detenerCamara = useCallback(() => {
    flujoRef.current?.getTracks().forEach((pista) => pista.stop());
    flujoRef.current = null;
  }, []);

  // Al desmontar: apagar la cámara (la luz del celular no debe quedar encendida).
  useEffect(() => detenerCamara, [detenerCamara]);

  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  // Conecta el flujo al <video> cuando ya existe en el DOM.
  useEffect(() => {
    if (fase === "camara" && videoRef.current && flujoRef.current) {
      videoRef.current.srcObject = flujoRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [fase]);

  // React 19 reinicia el <form> tras cada Server Action: se devuelve el archivo al input (ver CampoFoto).
  useEffect(() => {
    if (archivo && inputRef.current && inputRef.current.files?.length === 0) {
      const datos = new DataTransfer();
      datos.items.add(archivo);
      inputRef.current.files = datos.files;
    }
  });

  function guardar(final: File) {
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
    setCalidad(null);
    void analizarFoto(final).then(setCalidad);
    setFase("tomada");
  }

  async function abrirCamara() {
    setErrorLocal(undefined);
    detenerCamara();
    setAbriendo(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setAbriendo(false);
      setFase("negada");
      return;
    }
    try {
      flujoRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      setFase("camara");
    } catch {
      setFase("negada");
    } finally {
      setAbriendo(false);
    }
  }

  async function capturar() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const lienzo = document.createElement("canvas");
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext("2d")?.drawImage(video, 0, 0);
    setFlash(true);
    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", 0.9));
    detenerCamara();
    if (!blob) {
      setFase("negada");
      return;
    }
    guardar(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
  }

  // Alternativa sin permiso de cámara: input nativo con capture="user".
  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    if (!elegido) return;
    setErrorLocal(undefined);
    if (!["image/jpeg", "image/png", "image/webp"].includes(elegido.type)) {
      setErrorLocal("La foto debe ser JPG, PNG o WEBP.");
      evento.target.value = "";
      return;
    }
    const final = await comprimirFoto(elegido);
    if (final.size > 5 * 1024 * 1024) {
      setErrorLocal("La foto pesa demasiado (máximo 5 MB).");
      evento.target.value = "";
      return;
    }
    guardar(final);
  }

  const botonPrimario =
    "flex h-11.5 w-full items-center justify-center rounded-full bg-ga-verde text-14 font-extrabold text-white transition-colors duration-200 hover:bg-ga-verde-oscuro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde";

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-etiqueta`} className="text-15 font-bold">
        {label}
      </span>

      <div
        className={cx(
          "relative flex h-36 w-full items-center justify-center overflow-hidden rounded-14 sm:h-44",
          fase === "tomada" ? "bg-ga-verde-claro" : "bg-ga-navy",
          fase === "negada" && "border-1.5 border-dashed border-ga-borde-input bg-ga-fondo-suave",
          mensajeError && "outline outline-2 outline-ga-error",
        )}
      >
        {fase === "camara" ? (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              aria-label="Vista de tu cámara frontal"
              className="motion-safe:animate-ga-aparecer h-full w-full -scale-x-100 object-cover"
            />
            <span className={cx("pointer-events-none absolute", OVALO)} />
            <span className="absolute left-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-12 font-bold text-white">
              Cámara frontal
            </span>
          </>
        ) : null}
        {fase === "inicio" ? <span className={OVALO} /> : null}
        {/* Estado «abriendo cámara» (pieza 3j): mientras el navegador pide el permiso. */}
        {abriendo ? (
          <span role="status" className="absolute inset-x-0 bottom-2 text-center text-13 font-bold text-white motion-safe:animate-ga-aparecer">
            Abriendo cámara…
          </span>
        ) : null}
        {fase === "tomada" && previa ? (
          // Vista previa local (blob:), no un asset de next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previa}
            alt="Vista previa: tu selfie"
            className="motion-safe:animate-ga-aparecer h-full w-full object-cover"
          />
        ) : null}
        {fase === "negada" ? (
          <span className="flex flex-col items-center gap-1 px-3 text-center text-13 text-ga-texto-3">
            <span aria-hidden="true" className="text-20 text-ga-deshabilitado-texto">
              ⌀
            </span>
            No pudimos abrir tu cámara.
          </span>
        ) : null}
        {fase === "tomada" && calidad?.aceptable ? <SelloCalidadFoto /> : null}
        {flash ? (
          <span
            aria-hidden="true"
            onAnimationEnd={() => setFlash(false)}
            className="pointer-events-none absolute inset-0 bg-white motion-safe:animate-ga-flash motion-reduce:hidden"
          />
        ) : null}
      </div>

      {fase === "inicio" || fase === "camara" ? (
        <button
          type="button"
          onClick={fase === "inicio" ? abrirCamara : capturar}
          disabled={abriendo}
          aria-busy={abriendo || undefined}
          className={cx(botonPrimario, "disabled:cursor-wait disabled:opacity-70")}
        >
          {abriendo ? "Abriendo cámara…" : "Tomar selfie"}
        </button>
      ) : null}
      {fase === "tomada" ? (
        <>
          {calidad && !calidad.aceptable ? (
            <AvisoFotoDudosa
              mensaje={MENSAJE_FOTO_DUDOSA}
              alRepetir={abrirCamara}
              textoRepetir="Tomar la selfie de nuevo"
            />
          ) : null}
          <button
            type="button"
            onClick={abrirCamara}
            className="flex h-11.5 w-full items-center justify-center rounded-full border-1.5 border-ga-navy text-14 font-extrabold text-ga-navy transition-colors duration-200 hover:bg-ga-fondo-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
          >
            Repetir selfie
          </button>
        </>
      ) : null}
      {fase === "negada" ? (
        <button type="button" onClick={() => inputRef.current?.click()} className={botonPrimario}>
          Tomar o subir la foto
        </button>
      ) : null}

      {/* El archivo viaja aquí (mismo nombre de campo de siempre). Solo se abre desde «Tomar o subir la foto». */}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept="image/*"
        capture="user"
        tabIndex={-1}
        aria-labelledby={`${id}-etiqueta`}
        aria-invalid={mensajeError ? true : undefined}
        aria-describedby={mensajeError ? idError : undefined}
        onChange={alElegir}
        className="sr-only"
      />
      {mensajeError ? (
        <span id={idError} role="alert" className="text-13 font-semibold text-ga-error">
          {mensajeError}
        </span>
      ) : null}
    </div>
  );
}
