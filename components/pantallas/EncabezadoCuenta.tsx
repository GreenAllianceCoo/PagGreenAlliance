import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** Destino de «Nueva solicitud» (nav, accesos y estado vacío de /cuenta). */
export const RUTA_NUEVA_SOLICITUD = "/cuenta/solicitar";
/** «Perfil» del asociado (pieza 3k): pantalla propia, absorbe «Mis datos». */
export const RUTA_PERFIL = "/cuenta/perfil";

// Rediseño C+ (pieza 2b): el nav pasa de subrayado a píldora rellena
// (verde-claro de fondo, texto verde-oscuro), como en el resto del design
// system `3a`.
const CLASE_ACTIVO = "rounded-full bg-ga-verde-claro px-4.5 py-2.5 text-ga-verde-oscuro no-underline";
const CLASE_INACTIVO =
  "rounded-full px-4.5 py-2.5 text-ga-texto-2 no-underline hover:bg-ga-fondo-suave hover:text-ga-verde";

type EncabezadoCuentaProps = {
  nombre: string;
  /** Sección actual (subrayada y con aria-current). */
  seccion: "inicio" | "solicitud" | "perfil";
  /** Server Action de «Salir» (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
};

/**
 * Encabezado del área del asociado (pieza 2b de docs/Green Alliance C+.dc.html).
 * Se comparte entre /cuenta y /cuenta/solicitar.
 *
 * Nota de fidelidad: el lienzo (2b, mockup de 390 px) no lleva ninguna barra
 * con el logo en celular — la pantalla arranca directo en el saludo. Pero
 * `tests/e2e/a-navegacion.spec.ts` («Logo, «Inicio», «Nueva solicitud»,
 * «Convenios» y tarjetas href=#») hace clic en el enlace «Ir al inicio» en
 * AMBOS tamaños de pantalla, así que el logo se queda visible también en
 * celular (compacto, sin la píldora blanca que solo aparece desde `lg`).
 */
export function EncabezadoCuenta({ nombre, seccion, accionSalir }: EncabezadoCuentaProps) {
  return (
    <header className="px-5 pt-6 md:mx-auto md:max-w-2xl lg:mx-0 lg:max-w-none lg:px-10 lg:pt-3.5">
      {/* Escritorio: barra flotante en píldora blanca (pieza 2b, `header{padding:14px 40px 0}`
          + pill de 64 px). Celular: solo el logo, sin fondo (ver nota de fidelidad arriba). */}
      <div className="flex h-11 items-center justify-between gap-3 lg:h-16 lg:rounded-full lg:bg-white lg:pl-5 lg:pr-3 lg:shadow-pildora">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink lg:h-9">
          <Logo tone="dark" />
        </Link>
        {/* whitespace-nowrap: con nombres largos entre 1024 y ~1150 px, «Nueva solicitud»
            no debe partirse en 2 líneas (se hereda a los enlaces de adentro). */}
        <nav aria-label="Principal" className="hidden items-center gap-1 whitespace-nowrap text-16 font-bold lg:flex">
          <Link
            href="/cuenta"
            aria-current={seccion === "inicio" ? "page" : undefined}
            className={seccion === "inicio" ? CLASE_ACTIVO : CLASE_INACTIVO}
          >
            Inicio
          </Link>
          <Link
            href={RUTA_NUEVA_SOLICITUD}
            aria-current={seccion === "solicitud" ? "page" : undefined}
            className={seccion === "solicitud" ? CLASE_ACTIVO : CLASE_INACTIVO}
          >
            Nueva solicitud
          </Link>
          {/* Sección #convenios de /cuenta (decisión del 23-sep).
              TODO(pendiente-spec): confirmar si «Convenios» tendrá página propia. */}
          <a href={seccion === "inicio" ? "#convenios" : "/cuenta#convenios"} className={CLASE_INACTIVO}>
            Convenios
          </a>
          {/* «Perfil» (pieza 3k): pantalla propia /cuenta/perfil; absorbe «Mis datos». */}
          <Link
            href={RUTA_PERFIL}
            aria-current={seccion === "perfil" ? "page" : undefined}
            className={seccion === "perfil" ? CLASE_ACTIVO : CLASE_INACTIVO}
          >
            Perfil
          </Link>
        </nav>
        <div className="hidden items-center gap-3.5 text-15 lg:flex">
          {/* Nombre largo: no debe partir el header en 2 líneas entre 1024 y ~1150 px. */}
          <span className="max-w-[160px] truncate font-bold">{nombre}</span>
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
