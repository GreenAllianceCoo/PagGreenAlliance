import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PanelAfiliacionDetalle } from "@/components/admin/PanelAfiliacionDetalle";
import { IconoVolver } from "@/components/ui/Iconos";
import { exigirAdmin } from "@/lib/admin/servidor";
import { urlsFirmadasAfiliacion } from "@/lib/admin/fotos";
import { enmascararCedula } from "@/lib/mascara";
import { esEstadoAfiliacionValido, listarSolicitudesAfiliacion } from "../_datos";

export const metadata: Metadata = { title: "Solicitud de afiliación · Admin · Green Alliance" };

/** Detalle de una solicitud de afiliación: lista de hermanas + ficha con las 3 fotos (pieza 3e). */
export default async function DetalleAfiliacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, nombre: nombreAdmin } = await exigirAdmin();
  const { id } = await params;

  const { data: solicitud } = await supabase
    .from("solicitudes_afiliacion")
    .select(
      "id, nombre, cedula, grado, institucion, celular, nequi, email, mensaje, asesor_id, estado, foto_cedula_frente, foto_cedula_reverso, foto_selfie, created_at",
    )
    .eq("id", id)
    .single();

  if (!solicitud) notFound();

  const estadoValido = esEstadoAfiliacionValido(solicitud.estado) ? solicitud.estado : "pendiente";

  const [{ data: asesor }, fotos, { filas: hermanas }] = await Promise.all([
    solicitud.asesor_id
      ? supabase.from("perfiles").select("nombre_completo").eq("id", solicitud.asesor_id).single()
      : Promise.resolve({ data: null }),
    urlsFirmadasAfiliacion(solicitud),
    listarSolicitudesAfiliacion(supabase, estadoValido),
  ]);

  return (
    <AdminShell nombre={nombreAdmin} seccion="afiliaciones">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/afiliaciones"
          aria-label="Volver a la lista de afiliaciones"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-admin-superficie lg:hidden"
        >
          <IconoVolver tamano={20} grosor={1.8} />
        </Link>
        <h1 className="m-0 font-display font-extrabold tracking-titular">
          <span className="text-20 lg:hidden">Solicitud de afiliación</span>
          <span className="hidden text-30 lg:inline lg:text-34">Afiliaciones</span>
        </h1>
      </div>

      <PanelAfiliacionDetalle
        solicitud={{
          id: solicitud.id,
          nombre: solicitud.nombre,
          cedula: solicitud.cedula,
          grado: solicitud.grado,
          institucion: solicitud.institucion,
          celular: solicitud.celular,
          nequi: solicitud.nequi,
          email: solicitud.email,
          mensaje: solicitud.mensaje,
          asesorNombre: asesor?.nombre_completo ?? null,
          estado: solicitud.estado,
          created_at: solicitud.created_at,
        }}
        fotos={fotos}
        // La cédula de las «hermanas» sale ya enmascarada del servidor: solo la de la ficha abierta viaja completa.
        hermanas={hermanas.map((h) => ({ ...h, cedula: enmascararCedula(h.cedula) }))}
      />
    </AdminShell>
  );
}
