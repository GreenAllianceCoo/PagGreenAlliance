import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { cargarPerfilAsociado } from "@/lib/asociado/servidor";
import { vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { hoyBogota } from "@/lib/fechas";
import { vistaProcesoEjecutivo } from "@/lib/procesoEjecutivo";
import { createClient } from "@/lib/supabase/server";
import { PerfilCliente } from "./PerfilCliente";

export const metadata: Metadata = {
  title: "Tu perfil · Cooperativa Green Alliance",
};

/**
 * Perfil del asociado (pieza 3k, decisión A1 de la revisión 2026-09-30): pantalla propia que
 * absorbe «Mis datos». Protegida igual que /cuenta (proxy.ts cubre «/cuenta/:path*»).
 */
export default async function PerfilPage() {
  const supabase = await createClient();

  // proxy.ts ya redirige sin sesión; se vuelve a comprobar aquí.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const hoy = hoyBogota(new Date());

  // Con la sesión del usuario (RLS): solo ve lo suyo. Nunca la tasa.
  const { data: solicitudes } = await supabase
    .from("solicitudes_credito")
    .select("estado, monto_solicitado, porcentaje_devolucion, plazo_meses, fecha_solicitud, fecha_respuesta, fecha_desembolso")
    .eq("asociado_id", user.id)
    .order("fecha_solicitud", { ascending: false })
    .limit(1);
  const ultima = (solicitudes?.[0] as FilaSolicitud | undefined) ?? null;
  const solicitud = ultima ? vistaSolicitud(ultima, hoy) : null;

  const perfil = await cargarPerfilAsociado(supabase, user.id, {
    tienePendiente: ultima?.estado === "pendiente",
    hoy,
  });

  // §12.6: cuenta dada de baja → sin datos; se cierra la sesión y se avisa en /ingresar.
  if (perfil && !perfil.activo) redirect(RUTA_CUENTA_INACTIVA);

  return (
    <PerfilCliente
      nombre={perfil?.nombre ?? "Asociado"}
      cedula={perfil?.cedula ?? "—"}
      grado={perfil?.gradoNombre ?? perfil?.gradoCodigo ?? "Sin asignar"}
      institucion={perfil?.institucion ?? null}
      asesorNombre={perfil?.asesorNombre ?? null}
      proceso={perfil?.proceso ?? vistaProcesoEjecutivo(null, hoy)}
      camino={perfil?.caminoEstabilidad}
      conteoCredito={solicitud?.conteo ?? null}
      plazoCreditoMeses={Number.parseInt(solicitud?.plazo ?? "3", 10) || 3}
      telefono={perfil?.telefono ?? ""}
    />
  );
}
