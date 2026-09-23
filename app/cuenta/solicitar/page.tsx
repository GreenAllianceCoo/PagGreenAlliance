import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoCuenta } from "@/components/pantallas/EncabezadoCuenta";
import { ButtonLink } from "@/components/ui/Button";
import { IconoVolver } from "@/components/ui/Iconos";
import { createClient } from "@/lib/supabase/server";
import { cerrarSesion } from "../actions";
import SolicitudForm from "./SolicitudForm";

export const metadata: Metadata = {
  title: "Nueva solicitud · Cooperativa Green Alliance",
};

/**
 * Solicitud de crédito del asociado («Nueva solicitud» en /cuenta).
 * No hay maqueta de esta pantalla: usa el encabezado, el fondo, las tarjetas
 * blancas y los cuadros grises de /cuenta (design/Inicio-*.dc.html).
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
    supabase.from("perfiles").select("nombre_completo, grado").eq("id", user.id).single(),
    supabase
      .from("solicitudes_credito")
      .select("estado")
      .eq("asociado_id", user.id)
      .order("fecha_solicitud", { ascending: false })
      .limit(1),
  ]);

  const tienePendiente = solicitudes?.[0]?.estado === "pendiente";

  const { data: paquetes } = perfil?.grado
    ? await supabase
        .from("grados_credito")
        .select("porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses")
        .eq("grado", perfil.grado)
        .order("porcentaje", { ascending: true })
    : { data: null };

  const aviso = !perfil?.grado
    ? "Tu perfil aún no tiene un grado asignado. Habla con la cooperativa para poder solicitar un crédito."
    : tienePendiente
      ? "Ya tienes una solicitud pendiente de revisión. Espera la respuesta antes de enviar una nueva."
      : !paquetes || paquetes.length === 0
        ? "Aún no hay topes de crédito configurados para tu grado. Habla con la cooperativa."
        : null;

  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      <EncabezadoCuenta
        nombre={perfil?.nombre_completo ?? "Asociado"}
        seccion="solicitud"
        accionSalir={cerrarSesion}
      />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-2xl lg:gap-6 lg:py-10">
        <div className="flex items-center gap-3">
          {/* Mismo botón redondo que «Cerrar sesión» en /cuenta (celular). */}
          <Link
            href="/cuenta"
            aria-label="Volver"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ga-navy"
          >
            <IconoVolver tamano={22} grosor={1.8} />
          </Link>
          <h1 className="m-0 text-24 font-extrabold text-ga-navy lg:text-32">Nueva solicitud</h1>
        </div>

        <section
          aria-labelledby="solicitud-titulo"
          className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:gap-5.5 lg:p-7"
        >
          <h2 id="solicitud-titulo" className="m-0 text-18 font-extrabold lg:text-20">
            Solicita tu crédito
          </h2>
          {aviso || !paquetes ? (
            <>
              <p className="m-0 rounded-10 bg-ga-fondo-suave p-3 text-15 leading-150 text-ga-texto-2 lg:px-3.5">
                {aviso}
              </p>
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
