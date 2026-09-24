import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WHATSAPP_URL } from "@/lib/config";
import { CONVENIOS } from "@/lib/convenios";
import { textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { enmascararCorreo } from "@/lib/mascara";
import { activarVistaPreviaSorteo } from "@/lib/sorteo/demo";
import { fechaBogota } from "@/lib/sorteo/fecha";
import { vistaSorteo, type FilaBoletaSorteo } from "@/lib/sorteo/vista";
import { createClient } from "@/lib/supabase/server";
import { CuentaCliente } from "./CuentaCliente";

export const metadata: Metadata = {
  title: "Mi cuenta · Cooperativa Green Alliance",
};

// Inicio del asociado.
export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ sorteo?: string }>;
}) {
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
  const [{ data: perfil }, { data: solicitudes }, { data: boletaCruda }] = await Promise.all([
    supabase
      .from("perfiles")
      .select("nombre_completo, cedula, grado, telefono, rol")
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
    // F2-01 (20260924000600): el número solo se puede leer por esta RPC, y
    // solo devuelve valor cuando la boleta ya está "confirmada". Antes se
    // seleccionaba la columna `numero` directo, pero la API REST no pasa por
    // vistaSorteo() y el asociado podía leerla ANTES de confirmar.
    supabase.rpc("mi_boleta_sorteo", { p_anio: anio, p_mes: mes }).maybeSingle(),
  ]);
  // Sin tipos generados de Supabase para esta RPC: se castea a la forma real
  // (mi_boleta_sorteo, migración 20260924000600) en vez de dejarla en `{}`.
  const boleta = boletaCruda as FilaBoletaSorteo | null;

  const { data: topes } = perfil?.grado
    ? await supabase.from("grados_credito").select("capacidad_maxima").eq("grado", perfil.grado)
    : { data: null };

  const ultima = (solicitudes?.[0] as FilaSolicitud | undefined) ?? null;

  // Vista previa del sorteo SOLO en desarrollo (?sorteo=demo): en producción
  // el parámetro se ignora (ver lib/sorteo/demo.ts).
  const { sorteo: parametroSorteo } = await searchParams;
  const demoSorteo = activarVistaPreviaSorteo(parametroSorteo, process.env.NODE_ENV);

  // S-13: solo los asociados participan en el sorteo (revisión de seguridad
  // 2026-09-24). El servidor ya lo exige en participarSorteo/confirmarBoletaSorteo;
  // aquí además se oculta el botón para quien no sea asociado.
  const esAsociado = perfil?.rol === "asociado";

  return (
    <CuentaCliente
      nombre={perfil?.nombre_completo ?? "Asociado"}
      tope={textoTope(topes)}
      solicitud={ultima ? vistaSolicitud(ultima) : null}
      convenios={CONVENIOS}
      sorteo={
        esAsociado
          ? {
              ...vistaSorteo(boleta ?? null, ahora),
              demo: demoSorteo,
              // Para el paso «confirmar» al reabrir el modal sin haber
              // confirmado todavía (F2-04, «Reenviar mi boleta»): sin esto,
              // ese paso no tendría a qué correo decir que se mandó el número.
              correoEnmascarado: user.email ? enmascararCorreo(user.email) : null,
            }
          : null
      }
      cedula={perfil?.cedula ?? "—"}
      // TODO(pendiente-spec): nombre completo del grado (hoy el código: PP, PT, SI, IT, OF).
      grado={perfil?.grado ?? "Sin asignar"}
      telefono={perfil?.telefono ?? ""}
      whatsappUrl={WHATSAPP_URL}
    />
  );
}
