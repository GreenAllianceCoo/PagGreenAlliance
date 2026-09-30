import Link from "next/link";
import { BarraInferior } from "@/components/ui/BarraInferior";
import { RUTA_NUEVA_SOLICITUD, RUTA_PERFIL } from "@/components/pantallas/EncabezadoCuenta";

const CLASE_BASE = "flex h-13 flex-col items-center justify-center rounded-full text-13 no-underline";
const CLASE_ACTIVA = `${CLASE_BASE} bg-ga-verde-claro font-extrabold text-ga-verde-oscuro`;
const CLASE_INACTIVA = `${CLASE_BASE} font-bold text-ga-texto-3`;

/**
 * Barra inferior del asociado, solo en celular (pieza 2b, 4 pestañas: Inicio,
 * Solicitar, Sorteo, Perfil). «Perfil» es una pantalla propia (/cuenta/perfil,
 * pieza 3k) que absorbe «Mis datos». «Sorteo» es el ancla `#sorteo` de Inicio.
 *
 * Nav con nombre propio («Navegación del asociado», distinto de «Principal» y
 * «Accesos») para no chocar con los locators de las pruebas e2e. El acceso
 * rápido «Nueva solicitud» de Inicio se conserva (a-navegacion.spec.ts).
 */
export function BarraInferiorCuenta({ activa }: { activa: "inicio" | "perfil" }) {
  return (
    <BarraInferior>
      <nav
        aria-label="Navegación del asociado"
        className="grid grid-cols-4 gap-1 rounded-full bg-white p-1.5 shadow-comprobante-movil"
      >
        <Link href="/cuenta" aria-current={activa === "inicio" ? "page" : undefined} className={activa === "inicio" ? CLASE_ACTIVA : CLASE_INACTIVA}>
          Inicio
        </Link>
        <Link href={RUTA_NUEVA_SOLICITUD} className={CLASE_INACTIVA}>
          Solicitar
        </Link>
        <Link href="/cuenta#sorteo" className={CLASE_INACTIVA}>
          Sorteo
        </Link>
        <Link href={RUTA_PERFIL} aria-current={activa === "perfil" ? "page" : undefined} className={activa === "perfil" ? CLASE_ACTIVA : CLASE_INACTIVA}>
          Perfil
        </Link>
      </nav>
    </BarraInferior>
  );
}
