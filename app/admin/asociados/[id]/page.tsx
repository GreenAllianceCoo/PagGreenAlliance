import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { CorreoIngresoAsociado } from "@/components/admin/CorreoIngresoAsociado";
import { DetalleProcesoAsociado } from "@/components/admin/DetalleProcesoAsociado";
import { IconoVolver } from "@/components/ui/Iconos";
import { exigirAdmin } from "@/lib/admin/servidor";
import { cargarDetalleProceso } from "@/lib/admin/asociados";
import { cargarCorreoIngresoAsociado } from "@/lib/admin/recuperaciones";

export const metadata: Metadata = { title: "Asociado · Admin · Green Alliance" };

/** Detalle del asociado: proceso ejecutivo, inicio del embargo e historial (pieza 3m). */
export default async function DetalleAsociadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, nombre, userId } = await exigirAdmin();
  const { id } = await params;
  const detalle = await cargarDetalleProceso(supabase, id);
  if (!detalle) notFound();
  const correoIngreso = await cargarCorreoIngresoAsociado(supabase, id, userId);
  // El admin mueve el proceso de sus propios clientes (pedido de Sebas, 1-oct); solo el suyo no.
  const procesoBloqueado = detalle.asociado.id === userId;
  // El cambio de correo de ingreso sigue exigiendo otro admin para sus clientes (toma de cuentas).
  const correoBloqueado = procesoBloqueado || detalle.asociado.asesorId === userId;

  return (
    <AdminShell nombre={nombre} seccion="asociados">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/asociados"
          aria-label="Volver a la lista de asociados"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-admin-superficie"
        >
          <IconoVolver tamano={20} grosor={1.8} />
        </Link>
        {/* Pieza 3m: en celular el h1 es el nombre de la persona; en escritorio sigue siendo «Asociados». */}
        <h1 className="m-0 font-display text-24 font-extrabold tracking-titular lg:text-34">
          <span className="lg:hidden">{detalle.asociado.nombre}</span>
          <span className="hidden lg:inline">Asociados</span>
        </h1>
      </div>
      <div className="flex max-w-[640px] flex-col gap-4">
        <DetalleProcesoAsociado detalle={detalle} bloqueado={procesoBloqueado} />
        <CorreoIngresoAsociado
          asociadoId={detalle.asociado.id}
          nombre={detalle.asociado.nombre}
          pendiente={correoIngreso.pendiente}
          historial={correoIngreso.historial}
          bloqueado={correoBloqueado}
        />
      </div>
    </AdminShell>
  );
}
