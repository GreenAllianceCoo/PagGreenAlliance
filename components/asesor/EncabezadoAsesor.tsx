import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { IconoSalir } from "@/components/ui/Iconos";

type EncabezadoAsesorProps = {
  nombre: string;
  /** Server Action de «Salir» (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
};

/**
 * Encabezado de /asesor y /asesor/demo. No hay maqueta para la pantalla del
 * asesor: reutiliza la estructura y las clases del encabezado de /cuenta
 * (components/pantallas/EncabezadoCuenta.tsx), que no se puede editar.
 */
export function EncabezadoAsesor({ nombre, accionSalir }: EncabezadoAsesorProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-6 md:mx-auto md:max-w-2xl lg:mx-0 lg:h-19 lg:max-w-none lg:border-b lg:border-ga-linea lg:bg-white lg:px-14 lg:pt-0">
      <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
        <Logo tone="dark" />
      </Link>
      <div className="flex items-center gap-3.5 text-15">
        <span className="max-w-[160px] truncate font-bold lg:max-w-[220px]">{nombre}</span>
        <form action={accionSalir}>
          <button
            type="submit"
            className="inline-flex h-10 items-center gap-2 rounded-10 border-1.5 border-ga-borde px-3.5 font-bold text-ga-navy hover:bg-ga-fondo-suave"
          >
            <IconoSalir tamano={18} grosor={1.8} className="lg:hidden" />
            <span className="hidden lg:inline">Salir</span>
            <span className="sr-only lg:hidden">Salir</span>
          </button>
        </form>
      </div>
    </header>
  );
}
