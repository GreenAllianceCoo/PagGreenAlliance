import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WHATSAPP_URL } from "@/lib/config";
import { CONVENIOS } from "@/lib/convenios";
import { textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { fechaBogota } from "@/lib/sorteo/fecha";
import { vistaSorteo } from "@/lib/sorteo/vista";
import { createClient } from "@/lib/supabase/server";
import { CuentaCliente } from "./CuentaCliente";

export const metadata: Metadata = {
  title: "Mi cuenta · Cooperativa Green Alliance",
};

// Inicio del asociado.
export default async function CuentaPage() {
  const supabase = await createClient();

  // proxy.ts ya redirige sin sesión; se vuelve a comprobar aquí.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  // Sorteo del mes en curso (hora de Colombia): igual regla que
  // public.sorteo_ventana_abierta() en la base (lib/sorteo/fecha.ts).
  const ahora = new Date();
  const { anio, mes } = fechaBogota(ahora);

  // Todo con la sesión del usuario (RLS): solo ve lo suyo.
  const [{ data: perfil }, { data: solicitudes }, { data: boleta }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("nombre_completo, cedula, grado, telefono")
      .eq("id", user.id)
      .single(),
    supabase
      .from("solicitudes_credito")
      .select(
        "estado, monto_solicitado, porcentaje_devolucion, plazo_meses, tasa_interes_mensual, fecha_solicitud, fecha_respuesta",
      )
      .eq("asociado_id", user.id)
      .order("fecha_solicitud", { ascending: false })
      .limit(1),
    // No se selecciona `numero` a la ligera: vistaSorteo() decide si lo deja
    // pasar a las props del cliente (solo si ya está confirmada).
    supabase.from("boletas_sorteo").select("estado, numero").eq("anio", anio).eq("mes", mes).maybeSingle(),
  ]);

  const { data: topes } = perfil?.grado
    ? await supabase.from("grados_credito").select("capacidad_maxima").eq("grado", perfil.grado)
    : { data: null };

  const ultima = (solicitudes?.[0] as FilaSolicitud | undefined) ?? null;

  return (
    <CuentaCliente
      nombre={perfil?.nombre_completo ?? "Asociado"}
      tope={textoTope(topes)}
      solicitud={ultima ? vistaSolicitud(ultima) : null}
      convenios={CONVENIOS}
      sorteo={vistaSorteo(boleta ?? null, ahora)}
      cedula={perfil?.cedula ?? "—"}
      // TODO(pendiente-spec): nombre completo del grado (hoy el código: PP, PT, SI, IT, OF).
      grado={perfil?.grado ?? "Sin asignar"}
      telefono={perfil?.telefono ?? ""}
      whatsappUrl={WHATSAPP_URL}
    />
  );
}
