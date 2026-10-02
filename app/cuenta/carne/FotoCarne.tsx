"use client";

import { useRef, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CONSEJO_FOTO_CARNE, TEXTO_FORMATOS_FOTO_CARNE, errorDeArchivoFotoCarne, esTipoFotoCarne } from "@/lib/fotoCarne";
import { recortarFotoCarne } from "@/lib/fotoCarneCliente";
import { createClient } from "@/lib/supabase/client";
import { guardarFotoCarne, prepararFotoCarne, quitarFotoCarne } from "./actions";

/**
 * Cambiar la foto del carné. El archivo se recorta cuadrado y se comprime en el navegador,
 * y sube DIRECTO a Storage con una URL firmada (como la afiliación); el servidor vuelve a
 * verificar los bytes antes de guardarla. Deshabilitado mientras sube (sin doble envío).
 */
export function FotoCarne({ origen }: { origen: "propia" | "afiliacion" | null }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [quitando, iniciarQuitar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ocupado = subiendo || quitando;

  async function alElegir(evento: ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0];
    evento.target.value = "";
    if (!elegido) return;
    setError(null);
    setAviso(null);
    // Se valida el tipo antes de procesar (el peso se valida sobre la foto ya recortada).
    if (!esTipoFotoCarne(elegido.type)) {
      setError("La foto debe ser JPG, PNG o WEBP.");
      return;
    }
    setSubiendo(true);
    try {
      const foto = await recortarFotoCarne(elegido);
      if (!foto) {
        setError("No pudimos leer esa foto. Prueba con otra.");
        return;
      }
      const errorFinal = errorDeArchivoFotoCarne(foto);
      if (errorFinal) {
        setError(errorFinal);
        return;
      }
      const preparada = await prepararFotoCarne({ tipo: foto.type, tamano: foto.size });
      if (!preparada.ok) {
        setError(preparada.error);
        return;
      }
      const { error: errorSubida } = await createClient()
        .storage.from(preparada.bucket)
        .uploadToSignedUrl(preparada.ruta, preparada.token, foto, { contentType: foto.type });
      if (errorSubida) {
        setError("No pudimos subir la foto. Revisa tu conexión e intenta de nuevo.");
        return;
      }
      const guardada = await guardarFotoCarne({ ruta: preparada.ruta });
      if (guardada.error) {
        setError(guardada.error);
        return;
      }
      setAviso("Listo: tu foto nueva ya está en el carné.");
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  }

  function volverASelfie() {
    setError(null);
    setAviso(null);
    iniciarQuitar(async () => {
      const r = await quitarFotoCarne();
      if (r.error) {
        setError(r.error);
        return;
      }
      setAviso("Listo: el carné vuelve a usar tu selfie de la afiliación.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="titulo-foto-carne" className="flex flex-col gap-3 rounded-28 bg-white p-6">
      <h2 id="titulo-foto-carne" className="m-0 font-display text-20 font-extrabold text-ga-navy">
        Foto de tu carné
      </h2>
      <p className="m-0 text-14 leading-150 text-ga-texto-2">
        {origen === "propia"
          ? "Estás usando la foto que subiste tú."
          : origen === "afiliacion"
            ? "Estás usando la selfie de tu afiliación."
            : "Todavía no hay una foto en tu carné."}{" "}
        {CONSEJO_FOTO_CARNE}
      </p>
      <input
        ref={entrada}
        id="foto-carne-archivo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="Elegir la foto del carné"
        aria-describedby={error ? "foto-carne-error" : "foto-carne-formatos"}
        onChange={alElegir}
        className="sr-only"
        tabIndex={-1}
      />
      <Button
        type="button"
        variante="secundario"
        disabled={ocupado}
        cargando={subiendo}
        textoCargando="Subiendo foto…"
        onClick={() => entrada.current?.click()}
      >
        Cambiar foto
      </Button>
      {origen === "propia" ? (
        <Button
          type="button"
          variante="terciario"
          disabled={ocupado}
          cargando={quitando}
          textoCargando="Quitando…"
          onClick={volverASelfie}
        >
          Usar mi selfie de afiliación
        </Button>
      ) : null}
      <p id="foto-carne-formatos" className="m-0 text-13 text-ga-texto-2">
        {TEXTO_FORMATOS_FOTO_CARNE}. Se recorta en cuadrado.
      </p>
      {error ? (
        <p id="foto-carne-error" role="alert" className="m-0 text-13 font-semibold text-ga-error">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="m-0 text-13 text-ga-texto-2">
        {aviso ?? ""}
      </p>
    </section>
  );
}
