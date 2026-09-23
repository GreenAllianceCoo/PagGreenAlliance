import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

/** Destino de «Nueva solicitud» (nav, accesos y estado vacío de /cuenta). */
export const RUTA_NUEVA_SOLICITUD = "/cuenta/solicitar";

const CLASE_ACTIVO = "border-b-2 border-ga-verde pb-1 text-ga-verde no-underline";
const CLASE_INACTIVO = "text-ga-texto no-underline hover:text-ga-verde";

type EncabezadoCuentaProps = {
  nombre: string;
  /** Sección actual (subrayada y con aria-current). */
  seccion: "inicio" | "solicitud";
  /** Server Action de «Salir» (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
};

/**
 * Encabezado del área del asociado (design/Inicio-PC.dc.html + Inicio-Movil.dc.html).
 * Se comparte entre /cuenta y /cuenta/solicitar; las clases son las de Inicio.
 */
export function EncabezadoCuenta({ nombre, seccion, accionSalir }: EncabezadoCuentaProps) {
  return (
    // Celular: la maqueta deja 48 px arriba para simular la barra de estado del teléfono;
    // en el navegador se usa 24 px, como en las demás pantallas. En tableta el header se
    // alinea con el contenido centrado (max-w-2xl).
    <header className="flex items-center justify-between gap-3 px-5 pt-6 md:mx-auto md:max-w-2xl lg:mx-0 lg:h-19 lg:max-w-none lg:border-b lg:border-ga-linea lg:bg-white lg:px-14 lg:pt-0">
      <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
        <Logo tone="dark" />
      </Link>
      <nav aria-label="Principal" className="hidden gap-7 text-16 font-bold lg:flex">
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
      </nav>
      <div className="hidden items-center gap-3.5 text-15 lg:flex">
        <span className="font-bold">{nombre}</span>
        <form action={accionSalir}>
          <button
            type="submit"
            className="inline-flex h-10 items-center rounded-10 border-1.5 border-ga-borde px-3.5 font-bold text-ga-navy hover:bg-ga-fondo-suave"
          >
            Salir
          </button>
        </form>
      </div>
    </header>
  );
}
