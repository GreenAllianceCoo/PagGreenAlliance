import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { IconoVolver } from "@/components/ui/Iconos";
import { cx } from "@/components/ui/cx";

type PanelIngresoProps = {
  titulo: ReactNode;
  subtitulo: ReactNode;
  /** Contenido extra del panel que solo se ve en escritorio (p. ej. lista de beneficios). */
  extraEscritorio?: ReactNode;
  /** Texto al pie del panel (solo escritorio; en celular va al final del formulario). */
  pie: ReactNode;
  /**
   * Destino del botón «Volver» del panel (solo celular). Sin valor, no se muestra.
   * Es un <a> normal (navegación completa, sin prefetch).
   */
  volverHref?: string;
  /**
   * Quita el relleno superior extra del panel en celular. La maqueta (390×844)
   * reserva ~28 px de más arriba para la barra de estado del iPhone (52 px en vez
   * de 24 px); en el navegador esa barra queda fuera del viewport, así que el
   * panel pasa a 24 px arriba y 222 px de alto (misma distancia logo → título).
   * Por defecto `false` para no cambiar /ingresar/codigo sin aprobación.
   */
  sinBarraEstado?: boolean;
  /** Interlineado 1.5 en el texto del pie (Código lo usa; Ingreso no). */
  pieInterlineado?: boolean;
  /** El formulario de la derecha (escritorio) o de abajo (celular). */
  children: ReactNode;
};

/**
 * Entre 640 y 1023 px (`sm` a `lg`) el logo y el título del panel verde van en la misma
 * columna centrada de 440 px que el formulario, para que queden alineados con él.
 * < 640 px: sin efecto (todo el ancho con 24 px de margen, como en la maqueta Móvil).
 * ≥ 1024 px: se anula (`lg:mx-0 lg:max-w-none`) y el panel queda como en la versión PC.
 */
const COLUMNA_TABLETA = "sm:mx-auto sm:w-full sm:max-w-form-ingreso lg:mx-0 lg:max-w-none";

/**
 * Esqueleto de /ingresar y /ingresar/codigo.
 * Celular: panel verde de 250 px (222 px con `sinBarraEstado`) arriba + formulario abajo
 * (desde `sm` el formulario, el logo y el título quedan en una columna centrada de 440 px).
 * Escritorio (lg): panel verde de 540 px a la izquierda + formulario centrado.
 */
export function PanelIngreso({
  titulo,
  subtitulo,
  extraEscritorio,
  pie,
  volverHref,
  sinBarraEstado = false,
  pieInterlineado = true,
  children,
}: PanelIngresoProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      <aside
        className={cx(
          "flex shrink-0 flex-col justify-between bg-ga-verde px-6 pb-7 text-white",
          sinBarraEstado ? "h-55.5 pt-6" : "h-62.5 pt-13",
          "lg:h-auto lg:min-h-dvh lg:w-panel-ingreso lg:justify-start lg:gap-8 lg:px-14 lg:py-12",
        )}
      >
        <div className={cx("flex items-center justify-between", COLUMNA_TABLETA)}>
          <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo">
            <Logo tone="light" />
          </Link>
          {volverHref ? (
            // <a> normal (sin prefetch): en /ingresar/codigo apunta a /ingresar/cambiar,
            // un Route Handler que borra la cookie del paso 1.
            <a
              href={volverHref}
              aria-label="Volver"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ga-blanco-translucido text-white lg:hidden"
            >
              <IconoVolver tamano={22} />
            </a>
          ) : null}
        </div>
        <div className={cx("flex flex-col gap-1.5 lg:mt-14 lg:gap-3.5", COLUMNA_TABLETA)}>
          <h1 className="m-0 text-32 font-extrabold leading-110 lg:text-46 lg:leading-108 lg:tracking-titulo">
            {titulo}
          </h1>
          <p className="m-0 text-16 leading-145 text-ga-verde-claro lg:text-18 lg:leading-155">
            {subtitulo}
          </p>
        </div>
        {extraEscritorio}
        <span
          className={cx(
            "mt-auto hidden text-15 text-ga-verde-claro lg:block",
            pieInterlineado && "leading-150",
          )}
        >
          {pie}
        </span>
      </aside>
      <main className="flex grow flex-col lg:items-center lg:justify-center lg:p-12">
        {children}
      </main>
    </div>
  );
}

/**
 * Clases del <form> que va dentro de PanelIngreso.
 * - < 640 px (celular): todo el ancho con 24 px de margen, como Ingreso-Movil / Codigo-Movil.
 * - ≥ 640 px (`sm`): columna centrada de 440 px (el ancho del formulario en la versión PC),
 *   para que no se estire en tabletas pequeñas / celulares horizontales. Desde 640 px siempre
 *   sobran ≥ 200 px, así que el margen lateral de 24 px ya no hace falta (`sm:px-0`).
 * - ≥ 1024 px (`lg`): ancho fijo de 440 px centrado a la derecha del panel verde.
 */
export const CLASES_FORM_INGRESO =
  "flex w-full grow flex-col gap-4.5 p-6 sm:mx-auto sm:max-w-form-ingreso sm:px-0 lg:w-form-ingreso lg:grow-0 lg:gap-5 lg:p-0";

/** Texto de WhatsApp al final del formulario (solo celular). */
export function PieIngresoMovil({
  children,
  interlineado = true,
}: {
  children: ReactNode;
  interlineado?: boolean;
}) {
  return (
    <span
      className={cx(
        "mt-auto text-center text-14 text-ga-texto-3 lg:hidden",
        interlineado && "leading-150",
      )}
    >
      {children}
    </span>
  );
}
