"use client";

import { useState } from "react";

type Props = { etiqueta: string; url: string | null };

/**
 * Visor de una foto de afiliación (pieza 3e), con sus 3 estados: cargando
 * (destello mientras el navegador todavía está descargando la imagen),
 * disponible, y enlace vencido (si no llegó URL firmada, o si la imagen
 * falla al cargar porque el enlace ya venció — dura pocos minutos, spec §3).
 */
export function FotoAfiliacion({ etiqueta, url }: Props) {
  const [estado, setEstado] = useState<"cargando" | "lista" | "vencido">(url ? "cargando" : "vencido");

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-13 font-bold text-admin-texto-2">{etiqueta}</span>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-12 bg-admin-superficie-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no apta para next/image remoto.
          <img
            src={url}
            alt={etiqueta}
            onLoad={() => setEstado("lista")}
            onError={() => setEstado("vencido")}
            className={
              "h-full w-full object-cover transition-opacity duration-300 " + (estado === "lista" ? "opacity-100" : "opacity-0")
            }
          />
        ) : null}
        {estado === "cargando" ? (
          <div
            aria-hidden="true"
            className="motion-safe:animate-pulse absolute inset-0 bg-gradient-to-r from-admin-superficie-2 via-admin-superficie to-admin-superficie-2"
          />
        ) : null}
        {estado === "vencido" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-12 border-1.5 border-dashed border-admin-borde p-2.5 text-center">
            <span aria-hidden="true" className="text-20 text-admin-rojo-2">
              ⟳
            </span>
            <span className="text-12 text-admin-texto-3">El enlace venció. Recarga la página.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
