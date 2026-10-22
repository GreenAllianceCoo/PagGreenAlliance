"use client";

import { usePathname } from "next/navigation";
import { enlaceWhatsappFlotante } from "@/lib/config";
import { cx } from "./cx";
import { IconoWhatsapp } from "./Iconos";

/** Rutas donde no va el botón: paneles internos, la verificación del carné y la pausa (ya trae su botón). */
const SIN_BOTON = ["/admin", "/asesor", "/verificar", "/cuenta-pausada"];

/**
 * Botón pequeño, fijo abajo a la derecha, que abre WhatsApp con el número de
 * la cooperativa y un mensaje prellenado. El de `app/layout.tsx` va sin nombre
 * y se oculta en /cuenta, donde `app/cuenta/layout.tsx` pone el suyo con el
 * nombre del asociado (`conNombre`). En celular, dentro de /cuenta, sube por
 * encima de la barra inferior.
 */
export function BotonWhatsappFlotante({ nombre, conNombre = false }: { nombre?: string | null; conNombre?: boolean }) {
  const ruta = usePathname() ?? "";
  const enCuenta = ruta === "/cuenta" || ruta.startsWith("/cuenta/");
  if (SIN_BOTON.some((r) => ruta === r || ruta.startsWith(`${r}/`))) return null;
  if (enCuenta !== conNombre) return null;

  const href = enlaceWhatsappFlotante(nombre);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      title="Escríbenos por WhatsApp"
      data-testid="whatsapp-flotante"
      className={cx(
        "fixed right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_6px_20px_rgba(10,37,64,0.22)] transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde lg:right-6 lg:bottom-6",
        enCuenta ? "bottom-[calc(env(safe-area-inset-bottom,0px)+6rem)]" : "bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)]",
      )}
    >
      <IconoWhatsapp tamano={28} />
    </a>
  );
}
