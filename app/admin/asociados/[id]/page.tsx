import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ComprobantesPorBorrar, type ComprobantePorBorrar } from "@/components/admin/ComprobantesPorBorrar";
import { fechaBogotaDeInstante } from "@/lib/fechas";
import { CorreoIngresoAsociado } from "@/components/admin/CorreoIngresoAsociado";
import { DetalleProcesoAsociado } from "@/components/admin/DetalleProcesoAsociado";
import { EliminarAsociado } from "@/components/admin/EliminarAsociado";
import { IconoVolver } from "@/components/ui/Iconos";
import { exigirAdminOSecretario } from "@/lib/admin/servidor";
import { urlFotoCarneDeAsociado } from "@/lib/carneFoto";
import { cargarDetalleProceso } from "@/lib/admin/asociados";
import { cargarCorreoIngresoAsociado } from "@/lib/admin/recuperaciones";

export const metadata: Metadata = { title: "Asociado · Admin · Green Alliance" };

/**
 * Detalle del asociado: proceso ejecutivo, inicio del embargo e historial (pieza 3m).
 * El secretario la ve en solo lectura salvo el proceso ejecutivo: sin baja, eliminar, habilitar
 * crédito, correo de ingreso, foto del carné ni comprobantes (el servidor y la base lo impiden).
 */
export default async function DetalleAsociadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, nombre, userId, rol } = await exigirAdminOSecretario();
  const esAdmin = rol === "admin";
  const { id } = await params;
  const detalle = await cargarDetalleProceso(supabase, id, { incluirHabilitar: esAdmin });
  if (!detalle) notFound();
  const { asociado } = detalle;
  const correoIngreso = asociado.eliminado || !esAdmin
    ? { pendiente: null, historial: [] }
    : await cargarCorreoIngresoAsociado(supabase, id, userId);
  // Foto del carné (propia o la selfie de la afiliación): URL firmada corta, solo para el admin.
  const fotoCarne = !esAdmin || asociado.eliminado || asociado.rol !== "asociado" ? null : await urlFotoCarneDeAsociado(asociado.id);
  // Comprobantes de desembolso del eliminado: se guardan 30 días y solo el admin los ve.
  let comprobantesPorBorrar: ComprobantePorBorrar[] = [];
  if (esAdmin && asociado.eliminado) {
    const { data } = await supabase
      .from("solicitudes_credito")
      .select("id, comprobante_borrar_at")
      .eq("asociado_id", id)
      .not("comprobante_borrar_at", "is", null)
      .not("comprobante_subido_at", "is", null)
      .order("comprobante_borrar_at");
    comprobantesPorBorrar = (data ?? []).map((s) => {
      const [anio, mes, dia] = fechaBogotaDeInstante(s.comprobante_borrar_at as string).split("-");
      return { solicitudId: s.id as string, borrarEl: `${dia}/${mes}/${anio}` };
    });
  }
  // El admin mueve el proceso de sus propios clientes (pedido de Sebas, 1-oct); solo el suyo no.
  const procesoBloqueado = asociado.id === userId;
  // El cambio de correo de ingreso sigue exigiendo otro admin para sus clientes (toma de cuentas).
  const correoBloqueado = procesoBloqueado || asociado.asesorId === userId;

  return (
    <AdminShell nombre={nombre} seccion="asociados" rol={rol}>
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
          <span className="lg:hidden">{asociado.nombre}</span>
          <span className="hidden lg:inline">Asociados</span>
        </h1>
      </div>
      {asociado.eliminado ? (
        <>
          <p role="status" className="m-0 max-w-[640px] rounded-20 bg-admin-superficie p-5.5 text-15 leading-150 text-admin-texto-2">
            <strong className="text-admin-texto">Asociado eliminado.</strong> Sus datos personales se borraron; solo se conservan
            sus cifras (créditos, pagos y comisiones) y el registro de quién lo eliminó y por qué.
          </p>
          {esAdmin && comprobantesPorBorrar.length > 0 ? <ComprobantesPorBorrar comprobantes={comprobantesPorBorrar} /> : null}
        </>
      ) : (
        <div className="flex max-w-[640px] flex-col gap-4">
          <DetalleProcesoAsociado detalle={detalle} bloqueado={procesoBloqueado} soloProceso={!esAdmin} />
          {esAdmin && asociado.rol === "asociado" ? (
            <section aria-labelledby="titulo-foto-carne" className="flex items-center gap-4 rounded-20 bg-admin-superficie p-5.5">
              {fotoCarne ? (
                // URL firmada de Storage (caduca en minutos): no pasa por next/image.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fotoCarne.url}
                  alt={`Foto del carné de ${asociado.nombre}`}
                  width={96}
                  height={96}
                  data-testid="foto-carne-admin"
                  className="h-24 w-24 shrink-0 rounded-14 object-cover"
                />
              ) : null}
              <div className="flex flex-col gap-1">
                <h2 id="titulo-foto-carne" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
                  Foto del carné
                </h2>
                <p className="m-0 text-14 text-admin-texto-2">
                  {fotoCarne
                    ? fotoCarne.origen === "propia"
                      ? "Foto que subió el asociado."
                      : "Selfie de su afiliación."
                    : "Sin foto en el carné."}
                </p>
              </div>
            </section>
          ) : null}
          {esAdmin ? (
            <CorreoIngresoAsociado
              asociadoId={asociado.id}
              nombre={asociado.nombre}
              pendiente={correoIngreso.pendiente}
              historial={correoIngreso.historial}
              bloqueado={correoBloqueado}
            />
          ) : null}
          {/* Pedido de Sebas (1-oct): anonimizar al asociado dado de baja. Asesores y admins no se eliminan por aquí. */}
          {esAdmin && asociado.rol === "asociado" ? (
            <section className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5.5">
              <h2 className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">Eliminar definitivamente</h2>
              <EliminarAsociado
                asociadoId={asociado.id}
                nombre={asociado.nombre}
                activo={asociado.activo}
                esPropio={asociado.id === userId}
              />
            </section>
          ) : null}
        </div>
      )}
    </AdminShell>
  );
}
