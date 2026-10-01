import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoCuenta } from "@/components/pantallas/EncabezadoCuenta";
import { AvisoCreditoBloqueado } from "@/components/ui/AvisoCreditoBloqueado";
import { ButtonLink } from "@/components/ui/Button";
import { IconoSalir, IconoVolver } from "@/components/ui/Iconos";
import { MENSAJE_CREDITO_SIN_TOPES } from "@/lib/credito";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { reglaCreditoDe } from "@/lib/asociado/servidor";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "../actions";
import SolicitudForm from "./SolicitudForm";

export const metadata: Metadata = {
  title: "Nueva solicitud · Cooperativa Green Alliance",
};

/**
 * Solicitud de crédito del asociado («Nueva solicitud» en /cuenta), pieza 3d
 * de docs/Green Alliance C+.dc.html: usa el encabezado, el fondo, las
 * tarjetas blancas y los cuadros grises de /cuenta.
 */
export default async function SolicitarPage() {
  const supabase = await createClient();

  // proxy.ts ya redirige sin sesión; se vuelve a comprobar aquí.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  // Todo con la sesión del usuario (RLS): solo ve lo suyo.
  const [{ data: perfil }, { data: solicitudes }] = await Promise.all([
    supabase.from("perfiles").select("nombre_completo, grado, activo").eq("id", user.id).single(),
    supabase
      .from("solicitudes_credito")
      .select("estado")
      .eq("asociado_id", user.id)
      .order("fecha_solicitud", { ascending: false })
      .limit(1),
  ]);

  // §12.6: cuenta dada de baja → sin datos; se cierra la sesión y se avisa en /ingresar.
  if (perfil?.activo === false) redirect(RUTA_CUENTA_INACTIVA);

  // Regla de crédito (spec-requerimientos-ricardo §1 y §8): activo, grado con
  // cupo (por su GRUPO de crédito) y proceso ejecutivo en «operando», sin
  // otra pendiente. Los paquetes vienen sin tasa_interes_mensual (25-sep).
  const { regla, cupo } = await reglaCreditoDe(supabase, {
    activo: (perfil?.activo as boolean | null | undefined) ?? null,
    grado: perfil?.grado ?? null,
    tienePendiente: solicitudes?.[0]?.estado === "pendiente",
  });
  /** Para la pantalla (3k): si puede solicitar y, si no, por qué. */
  const puedeSolicitar = regla.puedeSolicitar;
  const aviso = regla.mensaje;
  const paquetes = cupo.estado === "con_cupo" ? cupo.paquetes : null;

  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      <EncabezadoCuenta
        nombre={perfil?.nombre_completo ?? "Asociado"}
        seccion="solicitud"
        accionSalir={cerrarSesion}
      />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-2xl lg:gap-6 lg:py-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/cuenta"
              aria-label="Volver"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ga-fondo-suave text-ga-navy"
            >
              <IconoVolver tamano={22} grosor={1.8} />
            </Link>
            <h1 className="m-0 font-display text-24 font-extrabold text-ga-navy lg:text-32">
              Nueva solicitud
            </h1>
          </div>
          {/* F-03: en celular también debe haber «Cerrar sesión», como en /cuenta. */}
          <form action={cerrarSesion} className="lg:hidden">
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ga-fondo-suave text-ga-navy"
            >
              <IconoSalir tamano={22} grosor={1.8} />
            </button>
          </form>
        </div>

        <section
          aria-labelledby="solicitud-titulo"
          className="flex flex-col gap-4 rounded-28 bg-white p-5 lg:gap-5.5 lg:p-9"
        >
          <h2 id="solicitud-titulo" className="m-0 font-display text-18 font-extrabold lg:text-20">
            Solicita tu crédito
          </h2>
          {!puedeSolicitar || !paquetes ? (
            <>
              {/* D-16: estado de crédito bloqueado (nunca un botón activo de solicitar). */}
              <AvisoCreditoBloqueado mensaje={aviso ?? MENSAJE_CREDITO_SIN_TOPES} />
              <ButtonLink href="/cuenta" variante="secundario" className="lg:self-start lg:px-9">
                Volver a mi cuenta
              </ButtonLink>
            </>
          ) : (
            <SolicitudForm paquetes={paquetes} />
          )}
        </section>
      </main>
    </div>
  );
}
