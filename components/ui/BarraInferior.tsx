import type { ReactNode } from "react";

/**
 * Envoltorio de la barra inferior flotante de /cuenta y /asesor (piezas 2b/2c
 * de docs/Green Alliance C+.dc.html). Siempre visible, como la navegación de
 * cualquier app: lo que queda debajo se alcanza haciendo scroll, porque la
 * página reserva al final el alto de la barra (`pb-28` / `pb-24`).
 *
 * En celular acostado y bajo (844×390) la barra deja de flotar
 * (`.ga-barra-inferior` en app/globals.css la vuelve `position: static`):
 * ahí ocuparía casi un cuarto de la pantalla y taparía el buscador.
 */
export function BarraInferior({ children }: { children: ReactNode }) {
  return <div className="ga-barra-inferior fixed inset-x-4 z-30 lg:hidden">{children}</div>;
}
