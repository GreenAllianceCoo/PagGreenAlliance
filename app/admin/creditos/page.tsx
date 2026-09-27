import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/AdminShell";
import { PanelCreditos, type FilaCreditoPanel } from "@/components/admin/PanelCreditos";
import { exigirAdmin } from "@/lib/admin/servidor";
import { formatearPesos } from "@/lib/cuenta";

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
  tasa_interes_mensual: number;
  grado: string;
  fecha_solicitud: string;
  fecha_respuesta: string | null;
  motivo_rechazo: string | null;
  perfiles: { nombre_completo: string; cedula: string; telefono: string | null } | null;
};

/** Lista de solicitudes de crédito (pieza 2d): menú lateral, KPIs, búsqueda, lista + detalle. */
export default async function CreditosPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const { supabase, nombre } = await exigirAdmin();
  const { estado: estadoCrudo } = await searchParams;
  const estado: Estado = esEstadoValido(estadoCrudo) ? estadoCrudo : "pendiente";

  // Se agregan `fecha_respuesta` y `perfiles.telefono` a la consulta que ya
  // existía (antes solo pedía nombre_completo y cedula): son columnas que ya
  // están en el esquema, para el historial y el «Celular» del detalle (pieza
  // 2d). No es una consulta nueva, solo 2 columnas más de la misma.
  const { data, error } = await supabase
    .from("solicitudes_credito")
    .select(
      "id, estado, monto_solicitado, porcentaje_devolucion, tasa_interes_mensual, grado, fecha_solicitud, fecha_respuesta, motivo_rechazo, perfiles:asociado_id(nombre_completo, cedula, telefono)",
    )
    .eq("estado", estado)
    .order("fecha_solicitud", { ascending: false });

  const crudas = (data ?? []) as unknown as FilaCruda[];
  const filas: FilaCreditoPanel[] = crudas.map((f) => ({
    id: f.id,
    estado: f.estado,
    monto_solicitado: Number(f.monto_solicitado),
    porcentaje_devolucion: f.porcentaje_devolucion,
    tasa_interes_mensual: Number(f.tasa_interes_mensual),
    grado: f.grado,
    fecha_solicitud: f.fecha_solicitud,
    fecha_respuesta: f.fecha_respuesta,
    motivo_rechazo: f.motivo_rechazo,
    nombre: f.perfiles?.nombre_completo ?? "—",
    cedula: f.perfiles?.cedula ?? "—",
    telefono: f.perfiles?.telefono ?? null,
  }));

  // «Aprobados este mes» / «Monto aprobado este mes»: solo se pueden calcular
  // sin una consulta nueva cuando la lista YA cargada es la de aprobados
  // (filtra por mes en memoria, sobre datos que ya llegaron). En las otras
  // pestañas quedan sin dato (TODO(backend) más abajo).
  let aprobadosEsteMes: number | undefined;
  let montoAprobadoEsteMes: string | undefined;
  if (estado === "aprobado") {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const esteMes = filas.filter((f) => f.fecha_respuesta && new Date(f.fecha_respuesta) >= inicioMes);
    aprobadosEsteMes = esteMes.length;
    montoAprobadoEsteMes = formatearPesos(esteMes.reduce((acc, f) => acc + f.monto_solicitado, 0));
  }

  return (
    <AdminShell nombre={nombre} seccion="creditos" contadorSeccionActual={estado === "pendiente" ? filas.length : undefined}>
      {error ? (
        <p className="m-0 rounded-12 bg-admin-superficie p-4 text-15 text-admin-rojo-2">
          No pudimos cargar las solicitudes. Intenta de nuevo.
        </p>
      ) : (
        <PanelCreditos
          filas={filas}
          estadoFiltro={estado}
          conteoFiltroActual={filas.length}
          kpis={{
            creditosPendientes: estado === "pendiente" ? filas.length : undefined,
            // TODO(backend): «Afiliaciones pendientes» necesita el conteo de
            // OTRA tabla (solicitudes_afiliacion), que esta página no carga.
            // Sin consulta nueva no se puede mostrar aquí — ver
            // docs/auditorias/2026-09-25-backend-rediseno-c-plus.md, fila «KPIs del admin».
            afiliacionesPendientes: undefined,
            aprobadosEsteMes,
            montoAprobadoEsteMes,
          }}
        />
      )}
    </AdminShell>
  );
}
