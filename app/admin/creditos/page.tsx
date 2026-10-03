import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { PanelCreditos, type FilaCreditoPanel } from "@/components/admin/PanelCreditos";
import { exigirAdminOSecretario } from "@/lib/admin/servidor";
import { cargarKpisAdmin } from "@/lib/admin/kpis";
import { cargarPaquetesDemo } from "@/lib/asesor/cargarPaquetesDemo";
import { formatearPesos } from "@/lib/cuenta";
import { registrar } from "@/lib/servidor/registro";

export const metadata: Metadata = { title: "Créditos · Admin · Green Alliance" };

const ESTADOS = ["pendiente", "aprobado", "rechazado"] as const;
type Estado = (typeof ESTADOS)[number];

function esEstadoValido(valor: string | undefined): valor is Estado {
  return !!valor && (ESTADOS as readonly string[]).includes(valor);
}

type FilaCruda = {
  id: string;
  estado: Estado;
  monto_solicitado: number;
  porcentaje_devolucion: "50" | "100";
  grado: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  fecha_desembolso: string | null;
  comprobante_subido_at: string | null;
  motivo_rechazo: string | null;
  perfiles: { nombre_completo: string; cedula: string; telefono: string | null } | null;
};

/**
 * Lista de solicitudes de crédito (pieza 2d): menú lateral, KPIs, búsqueda, lista + detalle.
 * El secretario la ve en SOLO LECTURA: sin aprobar, rechazar, desembolsar ni comprobantes,
 * y sin la tasa de interés (ni se le pide a la base: la RPC de tasas es solo admin).
 */
export default async function CreditosPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { supabase, nombre, rol } = await exigirAdminOSecretario();
  const soloLectura = rol === "secretario";
  const { estado: estadoCrudo } = await searchParams;
  const estado: Estado = esEstadoValido(estadoCrudo) ? estadoCrudo : "pendiente";

  // Se agregan `fecha_respuesta` y `perfiles.telefono` a la consulta que ya
  // existía (antes solo pedía nombre_completo y cedula): son columnas que ya
  // están en el esquema, para el historial y el «Celular» del detalle (pieza
  // 2d). No es una consulta nueva, solo 2 columnas más de la misma.
  //
  // Los KPI (cargarKpisAdmin) y los topes reales (cargarPaquetesDemo) son
  // consultas aparte, en paralelo: no dependen de la lista filtrada por
  // pestaña y por eso ahora son exactos sin importar qué estado se esté
  // viendo (antes «Afiliaciones pendientes» quedaba en «—» y los otros 2
  // KPI solo eran correctos en la pestaña «aprobado»).
  const [{ data, error }, kpis, paquetesPorGrado] = await Promise.all([
    supabase
      .from("solicitudes_credito")
      .select(
        "id, estado, monto_solicitado, porcentaje_devolucion, grado, fecha_solicitud, fecha_respuesta, fecha_desembolso, comprobante_subido_at, motivo_rechazo, perfiles:asociado_id(nombre_completo, cedula, telefono)",
      )
      .eq("estado", estado)
      .order("fecha_solicitud", { ascending: false }),
    cargarKpisAdmin(supabase),
    // El secretario no tiene los topes (tabla_credito_con_tasa es solo admin): sin aviso de tope, sin error en el registro.
    soloLectura ? Promise.resolve(null) : cargarPaquetesDemo(supabase, "admin_creditos_grados_fallo"),
  ]);

  const crudas = (data ?? []) as unknown as FilaCruda[];

  // Migración 20260930100300: authenticated (también el admin) ya no lee
  // solicitudes_credito.tasa_interes_mensual por la API; el admin la pide con
  // esta RPC (solo admin), por los ids de la lista.
  const tasas = new Map<string, number>();
  if (!soloLectura && crudas.length > 0) {
    const { data: filasTasa, error: errorTasas } = await supabase.rpc("admin_tasas_solicitudes", {
      p_ids: crudas.map((f) => f.id),
    });
    if (errorTasas) {
      registrar("error", { evento: "admin_tasas_solicitudes_fallo", codigo: errorTasas.code, mensaje: errorTasas.message });
    }
    for (const fila of (filasTasa ?? []) as { id: string; tasa_interes_mensual: number | string }[]) {
      tasas.set(fila.id, Number(fila.tasa_interes_mensual));
    }
  }

  const filas: FilaCreditoPanel[] = crudas.map((f) => ({
    id: f.id,
    estado: f.estado,
    monto_solicitado: Number(f.monto_solicitado),
    porcentaje_devolucion: f.porcentaje_devolucion,
    tasa_interes_mensual: soloLectura ? null : (tasas.get(f.id) ?? 0),
    grado: f.grado,
    fecha_solicitud: f.fecha_solicitud,
    fecha_respuesta: f.fecha_respuesta,
    fecha_desembolso: f.fecha_desembolso ? String(f.fecha_desembolso).slice(0, 10) : null,
    comprobante_subido_at: f.comprobante_subido_at,
    motivo_rechazo: f.motivo_rechazo,
    nombre: f.perfiles?.nombre_completo ?? "—",
    cedula: f.perfiles?.cedula ?? "—",
    telefono: f.perfiles?.telefono ?? null,
  }));

  return (
    <AdminShell nombre={nombre} seccion="creditos" rol={rol} contadorSeccionActual={estado === "pendiente" ? filas.length : undefined}>
      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las solicitudes. Intenta de nuevo.
        </p>
      ) : (
        <PanelCreditos
          filas={filas}
          estadoFiltro={estado}
          conteoFiltroActual={filas.length}
          soloLectura={soloLectura}
          paquetesPorGrado={paquetesPorGrado ?? {}}
          kpis={{
            creditosPendientes: kpis.creditosPendientes,
            afiliacionesPendientes: kpis.afiliacionesPendientes,
            aprobadosEsteMes: kpis.aprobadosEsteMes,
            montoAprobadoEsteMes: formatearPesos(kpis.montoAprobadoEsteMes),
          }}
        />
      )}
    </AdminShell>
  );
}
