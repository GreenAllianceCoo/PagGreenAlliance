import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RUTA_CUENTA_INACTIVA } from "@/lib/asociado/inactivo";
import { cargarPerfilAsociado } from "@/lib/asociado/servidor";
import { WHATSAPP_URL } from "@/lib/config";
import { cargarConvenios } from "@/lib/conveniosServidor";
import { textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import { hoyBogota } from "@/lib/fechas";
import { enmascararCorreo } from "@/lib/mascara";
import { cargarGanadorSorteo } from "@/lib/sorteo/ganador";
import { activarVistaPreviaSorteo } from "@/lib/sorteo/demo";
import { fechaBogota } from "@/lib/sorteo/fecha";
import { vistaSorteo, type FilaBoletaSorteo } from "@/lib/sorteo/vista";
import { createClient } from "@/lib/supabase/server";
import { Cuenta } from "@/components/pantallas/Cuenta";
import { ComprobanteDesembolso } from "@/components/cuenta/ComprobanteDesembolso";
import { cerrarSesion } from "./actions";

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
  const hoy = hoyBogota(ahora);
  const { anio, mes } = fechaBogota(ahora);

  // Todo con la sesión del usuario (RLS): solo ve lo suyo. Nunca la tasa.
  const [{ data: solicitudes }, { data: boletaCruda }, convenios, ganadorSorteo, { data: fechaHabilitacion }] = await Promise.all([
    supabase
      .from("solicitudes_credito")
      .select(
        "id, estado, monto_solicitado, porcentaje_devolucion, plazo_meses, fecha_solicitud, fecha_respuesta, fecha_desembolso, comprobante_subido_at",
      )
      .eq("asociado_id", user.id)
      .order("fecha_solicitud", { ascending: false })
      .limit(1),
    // F2-01 (20260924000600): el número solo se puede leer por esta RPC, y
    // solo devuelve valor cuando la boleta ya está "confirmada".
    supabase.rpc("mi_boleta_sorteo", { p_anio: anio, p_mes: mes }).maybeSingle(),
    cargarConvenios(),
    cargarGanadorSorteo(supabase),
    // §13.2: fecha en que el admin habilitó un nuevo crédito tras el rechazo (null = no). Nunca el motivo.
    supabase.rpc("mi_habilitacion_credito"),
  ]);
  const boleta = boletaCruda as FilaBoletaSorteo | null;
  const ultimaReal =
    (solicitudes?.[0] as (FilaSolicitud & { id: string; comprobante_subido_at: string | null }) | undefined) ?? null;
  // §13.2: rechazada y habilitada = tarjeta vacía con «Nueva solicitud» (la solicitud sigue en la base).
  const ultima = ultimaReal?.estado === "rechazado" && fechaHabilitacion ? null : ultimaReal;

  // Perfil (spec-requerimientos-ricardo §3): grado con nombre, institución,
  // asesor, proceso ejecutivo, conteo de 36 meses, cupo por grupo de crédito
  // y la regla «solo con el proceso operando» (§8).
  const perfil = await cargarPerfilAsociado(supabase, user.id, {
    tienePendiente: ultima?.estado === "pendiente",
    hoy,
  });

  // §12.6: cuenta dada de baja → sin datos; se cierra la sesión y se avisa en /ingresar.
  if (perfil && !perfil.activo) redirect(RUTA_CUENTA_INACTIVA);

  // Vista previa del sorteo SOLO en desarrollo (?sorteo=demo).
  const { sorteo: parametroSorteo } = await searchParams;
  const demoSorteo = activarVistaPreviaSorteo(parametroSorteo, process.env.NODE_ENV);

  // S-13: solo los asociados participan en el sorteo.
  const esAsociado = perfil?.rol === "asociado";

  const topes = perfil?.cupo.estado === "con_cupo" ? perfil.cupo.paquetes : null;

  return (
    <Cuenta
      nombre={perfil?.nombre ?? "Asociado"}
      tope={textoTope(topes, { sinCupo: perfil?.cupo.estado === "sin_cupo" })}
      solicitud={ultima ? vistaSolicitud(ultima, hoy) : null}
      convenios={convenios}
      sorteo={
        esAsociado
          ? {
              ...vistaSorteo(boleta ?? null, ahora),
              demo: demoSorteo,
              correoEnmascarado: user.email ? enmascararCorreo(user.email) : null,
            }
          : null
      }
      cedula={perfil?.cedula ?? "—"}
      // Se conserva el CÓDIGO (lo comparan las pruebas e2e); el nombre completo
      // se ve en /cuenta/perfil (pieza 3k).
      grado={perfil?.gradoCodigo ?? "Sin asignar"}
      institucion={perfil?.institucion ?? undefined}
      activo={perfil ? perfil.activo : undefined}
      whatsappUrl={WHATSAPP_URL}
      accionSalir={cerrarSesion}
      perfilAsociado={perfil}
      ganadorSorteo={ganadorSorteo}
      accionDesembolso={
        ultima ? (
          <ComprobanteDesembolso solicitudId={ultima.id} disponible={Boolean(ultima.comprobante_subido_at)} />
        ) : undefined
      }
    />
  );
}
