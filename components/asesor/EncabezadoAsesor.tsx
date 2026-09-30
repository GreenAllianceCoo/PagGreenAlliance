import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

type EncabezadoAsesorProps = {
  nombre: string;
  /** Rol a mostrar bajo el nombre, en escritorio (pieza 2c). */
  rol?: string;
  /** Server Action de «Salir» (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
  /**
   * Enlace a «Ver cuenta de demostración» (solo escritorio: en celular la
   * página muestra su propia píldora «Demo» junto al título, ver AsesorPage).
   * Si falta, el botón ámbar no se muestra (así lo usa /asesor/demo).
   */
  hrefDemo?: string;
  /**
   * Pestañas «Mis clientes» / «Comisiones» (pieza 3l). Sin `onPestana` (p. ej. /asesor/demo)
   * queda la única etiqueta «Mis clientes», como antes.
   */
  pestana?: "clientes" | "comisiones";
  onPestana?: (pestana: "clientes" | "comisiones") => void;
};

/**
 * Encabezado de /asesor y /asesor/demo (pieza 2c de docs/Green Alliance C+.dc.html):
 * barra flotante en píldora blanca en escritorio (mismo patrón que
 * EncabezadoCuenta, `components/pantallas/EncabezadoCuenta.tsx`, que no se
 * puede editar), con el nav «Mis clientes» siempre activo (una sola pantalla,
 * no hay «secciones» que alternar) y, a la derecha, nombre + rol y el acceso
 * a la cuenta de demostración. En celular solo queda el logo (misma nota de
 * fidelidad que EncabezadoCuenta: el lienzo no dibuja esta barra en 390 px,
 * el saludo y el título viven en el cuerpo de la página).
 */
export function EncabezadoAsesor({
  nombre,
  rol = "Asesor",
  accionSalir,
  hrefDemo,
  pestana = "clientes",
  onPestana,
}: EncabezadoAsesorProps) {
  const claseActiva = "rounded-full bg-ga-verde-claro px-4.5 py-2.5 text-16 font-bold text-ga-verde-oscuro";
  const claseInactiva =
    "rounded-full px-4.5 py-2.5 text-16 font-bold text-ga-texto-2 hover:bg-ga-fondo-suave hover:text-ga-verde";
  return (
    <header className="px-5 pt-6 md:mx-auto md:max-w-2xl lg:mx-0 lg:max-w-none lg:px-10 lg:pt-3.5">
      <div className="flex h-11 items-center justify-between gap-3 lg:h-16 lg:rounded-full lg:bg-white lg:pl-5 lg:pr-3 lg:shadow-pildora">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink lg:h-9">
          <Logo tone="dark" />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {onPestana ? (
            <>
              <button
                type="button"
                aria-current={pestana === "clientes" ? "page" : undefined}
                onClick={() => onPestana("clientes")}
                className={pestana === "clientes" ? claseActiva : claseInactiva}
              >
                Mis clientes
              </button>
              <button
                type="button"
                aria-current={pestana === "comisiones" ? "page" : undefined}
                onClick={() => onPestana("comisiones")}
                className={pestana === "comisiones" ? claseActiva : claseInactiva}
              >
                Comisiones
              </button>
            </>
          ) : (
            <span aria-current="page" className={claseActiva}>
              Mis clientes
            </span>
          )}
        </nav>
        <div className="hidden items-center gap-2.5 text-15 lg:flex">
          <span className="flex max-w-[180px] flex-col items-end leading-120">
            <span className="truncate font-bold">{nombre}</span>
            <span className="text-13 font-semibold text-ga-texto-3">{rol}</span>
          </span>
          {hrefDemo ? (
            <Link
              href={hrefDemo}
              className="inline-flex h-11 items-center whitespace-nowrap rounded-full bg-ga-ambar-fondo px-4.5 font-bold text-ga-ambar-texto no-underline hover:brightness-95"
            >
              Ver cuenta de demostración
            </Link>
          ) : null}
          <form action={accionSalir}>
            <button
              type="submit"
              className="inline-flex h-11 items-center rounded-full bg-ga-fondo-suave px-4.5 font-bold text-ga-navy hover:bg-ga-linea"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
