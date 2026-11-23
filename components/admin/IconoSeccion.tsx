import {
  IconoAjustes,
  IconoApreton,
  IconoBilletera,
  IconoCambios,
  IconoCampana,
  IconoCuadricula,
  IconoInsignia,
  IconoPantalla,
  IconoPersonaMas,
  IconoPersonas,
  IconoRegalo,
  IconoReloj,
} from "@/components/ui/Iconos";
import { cx } from "@/components/ui/cx";
import type { Seccion } from "./secciones";

/** Un tono por sección: el menú deja de ser una lista gris (fase 2, «admin con más color»). */
export const TONO_SECCION: Record<Seccion, { texto: string; fondo: string }> = {
  resumen: { texto: "text-admin-verde-2", fondo: "bg-admin-verde-fondo" },
  afiliaciones: { texto: "text-admin-ambar", fondo: "bg-admin-ambar-fondo" },
  creditos: { texto: "text-admin-verde-2", fondo: "bg-admin-verde-fondo" },
  asociados: { texto: "text-admin-azul", fondo: "bg-admin-azul-fondo" },
  asesores: { texto: "text-admin-violeta", fondo: "bg-admin-violeta-fondo" },
  alertas: { texto: "text-admin-rojo-2", fondo: "bg-admin-rojo-fondo" },
  convenios: { texto: "text-admin-rosa", fondo: "bg-admin-rosa-fondo" },
  sorteo: { texto: "text-admin-ambar", fondo: "bg-admin-ambar-fondo" },
  plataforma: { texto: "text-admin-azul", fondo: "bg-admin-azul-fondo" },
  historial: { texto: "text-admin-violeta", fondo: "bg-admin-violeta-fondo" },
  cambios: { texto: "text-admin-texto-2", fondo: "bg-admin-gris-fondo" },
  demo: { texto: "text-admin-texto-2", fondo: "bg-admin-gris-fondo" },
};

const ICONOS: Record<Seccion, typeof IconoCuadricula> = {
  resumen: IconoCuadricula,
  afiliaciones: IconoPersonaMas,
  creditos: IconoBilletera,
  asociados: IconoPersonas,
  asesores: IconoInsignia,
  alertas: IconoCampana,
  convenios: IconoApreton,
  sorteo: IconoRegalo,
  plataforma: IconoAjustes,
  historial: IconoReloj,
  cambios: IconoCambios,
  demo: IconoPantalla,
};

/** Ícono de la sección dentro de un cuadro con su tono. Decorativo: la etiqueta va al lado. */
export function IconoSeccion({ seccion, tamano = "md", className }: { seccion: Seccion; tamano?: "sm" | "md" | "lg"; className?: string }) {
  const Icono = ICONOS[seccion];
  const tono = TONO_SECCION[seccion];
  const caja = { sm: "h-6 w-6 rounded-6", md: "h-8 w-8 rounded-10", lg: "h-11 w-11 rounded-14" }[tamano];
  return (
    <span aria-hidden="true" className={cx("flex shrink-0 items-center justify-center", caja, tono.fondo, tono.texto, className)}>
      <Icono tamano={tamano === "sm" ? 14 : tamano === "md" ? 17 : 22} />
    </span>
  );
}
