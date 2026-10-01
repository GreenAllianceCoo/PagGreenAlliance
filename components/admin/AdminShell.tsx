import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cerrarSesion } from "@/app/cuenta/actions";
import { SECCIONES, type Seccion } from "./secciones";
import { EncabezadoAdmin } from "./EncabezadoAdmin";
import { contarAlertasPendientes } from "@/lib/admin/alertas";
import { createClient } from "@/lib/supabase/server";

type AdminShellProps = {
  nombre: string;
  seccion: Seccion;
  /**
   * Contador de pendientes para el chip de la pestaña, SOLO de la sección
   * activa (pieza 2d): cada página ya carga su propia lista filtrada por
   * `estado`, así que cuando el filtro activo es «pendiente» ese mismo largo
   * de lista es el contador — sin ninguna consulta nueva. Las otras 4
   * secciones se quedan sin chip (no hay dato ya cargado para ellas en esta
   * página); un chip de las 5 secciones a la vez necesitaría una consulta
   * agregada nueva — TODO(backend: ver docs/auditorias/2026-09-25-backend-rediseno-c-plus.md,
   * fila «KPIs del admin» — para ga-funcionalidad-botones).
   */
  contadorSeccionActual?: number;
  children: ReactNode;
};

const TONO_CHIP: Record<Seccion, string> = {
  resumen: "bg-admin-superficie-2 text-admin-texto-2",
  afiliaciones: "bg-admin-ambar-fondo text-admin-ambar",
  creditos: "bg-admin-verde-fondo text-admin-verde",
  asociados: "bg-admin-superficie-2 text-admin-texto-2",
  alertas: "bg-admin-rojo-fondo text-admin-rojo-2",
  asesores: "bg-admin-superficie-2 text-admin-texto-2",
  sorteo: "bg-admin-superficie-2 text-admin-texto-2",
  demo: "bg-admin-superficie-2 text-admin-texto-2",
};

/**
 * Fondo, menú lateral y ancho del contenido del panel de administración en
 * modo oscuro (piezas 2d/3e–3h). En celular el menú lateral se reemplaza por
 * `EncabezadoAdmin` (barra + pestañas en píldora, pieza 3h «El admin en
 * celular»).
 */
export async function AdminShell({ nombre, seccion, contadorSeccionActual, children }: AdminShellProps) {
  // Contador del menú «Alertas» (pieza 3m): pendientes de retiro anticipado y renovación, en todas las secciones.
  const alertasPendientes = await contarAlertasPendientes(await createClient());

  return (
    <div className="min-h-dvh bg-admin-fondo text-admin-texto lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <div className="lg:hidden">
        <EncabezadoAdmin nombre={nombre} seccion={seccion} alertasPendientes={alertasPendientes} />
      </div>

      <aside className="hidden flex-col gap-7 bg-admin-menu p-4 lg:flex">
        <Link href="/admin" aria-label="Ir al panel de administración" className="flex items-center gap-2.5 px-2">
          <Image src="/logos/blanco/green-alliance-isotipo-blanco.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] shrink-0" />
          <Image
            src="/logos/blanco/green-alliance-wordmark-blanco.svg"
            alt="Cooperativa Green Alliance"
            width={150}
            height={24}
            className="h-auto w-[150px]"
          />
        </Link>

        <nav className="flex flex-col gap-1 text-15 font-bold">
          {SECCIONES.map((s) => {
            const activa = s.clave === seccion;
            // «Alertas» muestra siempre cuántas hay pendientes; las demás, el contador de su lista si están activas.
            const chip = s.clave === "alertas" ? (alertasPendientes > 0 ? alertasPendientes : undefined) : activa ? contadorSeccionActual : undefined;
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={activa ? "page" : undefined}
                className={
                  "flex h-11 items-center justify-between rounded-12 px-3.5 no-underline transition-colors duration-200 " +
                  (activa ? "bg-admin-superficie-2 text-white" : "text-admin-texto-2 hover:bg-admin-superficie")
                }
              >
                {s.etiqueta}
                {chip !== undefined ? (
                  <span
                    className={
                      "flex h-[22px] min-w-[24px] items-center justify-center rounded-full px-1.5 text-12 " + TONO_CHIP[s.clave]
                    }
                  >
                    {chip}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2.5 rounded-14 bg-admin-superficie p-3.5">
          <span className="truncate text-14 font-bold">{nombre}</span>
          {/* No hay dato de género en `perfiles`: se deja un rótulo neutro
              (el diseño usa «Administradora» como ejemplo de María Fernanda López). */}
          <span className="text-13 text-admin-texto-3">Administrador</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex h-10 w-full items-center justify-center rounded-10 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie-2"
            >
              Salir
            </button>
          </form>
        </div>
      </aside>

      <main className="flex flex-col gap-5 px-4 py-5 lg:gap-5 lg:px-[30px] lg:py-[30px]">{children}</main>
    </div>
  );
}
