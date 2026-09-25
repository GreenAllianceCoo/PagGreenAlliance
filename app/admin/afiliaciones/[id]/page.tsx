import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AccionesAfiliacion } from "@/components/admin/AccionesAfiliacion";
import { Badge } from "@/components/ui/Badge";
import { exigirAdmin } from "@/lib/admin/servidor";
import { urlsFirmadasAfiliacion } from "@/lib/admin/fotos";

export const metadata: Metadata = { title: "Solicitud de afiliación · Admin · Green Alliance" };

const INSTITUCIONES: Record<string, string> = { policia: "Policía Nacional", ejercito: "Ejército Nacional" };

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
      <dt className="text-14 text-ga-texto-3">{etiqueta}</dt>
      <dd className="m-0 break-words text-16 font-bold text-ga-texto">{valor || "—"}</dd>
    </div>
  );
}

/** Detalle de una solicitud de afiliación: todos los datos + las 3 fotos con URL firmada. */
export default async function DetalleAfiliacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, nombre: nombreAdmin } = await exigirAdmin();
  const { id } = await params;

  const { data: solicitud } = await supabase
    .from("solicitudes_afiliacion")
    .select(
      "id, nombres, apellidos, nombre, cedula, grado, institucion, unidad, celular, nequi, email, mensaje, asesor_id, estado, foto_cedula_frente, foto_cedula_reverso, foto_selfie, acepto_datos_at, created_at",
    )
    .eq("id", id)
    .single();

  if (!solicitud) notFound();

  const [{ data: asesor }, fotos] = await Promise.all([
    solicitud.asesor_id
      ? supabase.from("perfiles").select("nombre_completo").eq("id", solicitud.asesor_id).single()
      : Promise.resolve({ data: null }),
    urlsFirmadasAfiliacion(solicitud),
  ]);

  return (
    <AdminShell nombre={nombreAdmin} seccion="afiliaciones">
      <div className="flex items-center justify-between gap-3">
        <h1 className="m-0 text-22 font-extrabold text-ga-navy lg:text-28">{solicitud.nombre}</h1>
        <Badge>{solicitud.estado}</Badge>
      </div>

      <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:p-7">
        <h2 className="m-0 text-18 font-extrabold">Datos de la solicitud</h2>
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Dato etiqueta="Nombres" valor={solicitud.nombres} />
          <Dato etiqueta="Apellidos" valor={solicitud.apellidos} />
          <Dato etiqueta="Cédula" valor={solicitud.cedula} />
          <Dato etiqueta="Grado" valor={solicitud.grado} />
          <Dato etiqueta="Institución" valor={INSTITUCIONES[solicitud.institucion ?? ""] ?? solicitud.institucion} />
          <Dato etiqueta="Celular" valor={solicitud.celular} />
          <Dato etiqueta="Nequi" valor={solicitud.nequi} />
          <Dato etiqueta="Correo institucional" valor={solicitud.email} />
          <Dato etiqueta="Asesor que refirió" valor={asesor?.nombre_completo ?? "Sin asesor"} />
          <Dato
            etiqueta="Enviada"
            valor={new Date(solicitud.created_at).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" })}
          />
        </dl>
        {solicitud.mensaje ? (
          <div className="flex flex-col gap-1">
            <span className="text-14 font-bold text-ga-texto-3">Mensaje</span>
            <p className="m-0 whitespace-pre-wrap text-15 text-ga-texto">{solicitud.mensaje}</p>
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:p-7">
        <h2 className="m-0 text-18 font-extrabold">Fotos</h2>
        <p className="m-0 text-13 text-ga-texto-3">
          Los enlaces vencen a los pocos minutos; recarga la página si ya no abren.
        </p>
        {/* S-07 (revisión de seguridad 2026-09-24): el correo completo se
            repite aquí, junto a las fotos, para compararlo sin desplazarse
            hasta «Datos de la solicitud». */}
        <p className="m-0 text-15">
          <span className="font-bold text-ga-texto-3">Correo institucional: </span>
          <span className="font-bold text-ga-texto">{solicitud.email || "—"}</span>
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { etiqueta: "Cédula (frente)", url: fotos.frente },
            { etiqueta: "Cédula (reverso)", url: fotos.reverso },
            { etiqueta: "Selfie", url: fotos.selfie },
          ].map((foto) => (
            <div key={foto.etiqueta} className="flex flex-col gap-2">
              <span className="text-14 font-bold text-ga-texto-3">{foto.etiqueta}</span>
              {foto.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal, no apta para next/image remoto.
                <img
                  src={foto.url}
                  alt={foto.etiqueta}
                  className="aspect-[3/4] w-full rounded-12 border-1.5 border-ga-borde object-cover"
                />
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-12 border-1.5 border-dashed border-ga-borde text-13 text-ga-texto-3">
                  No disponible
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:p-7">
        <h2 className="m-0 text-18 font-extrabold">Cambiar estado</h2>
        {/* S-07 (revisión de seguridad 2026-09-24): aviso antes de Aprobar/Rechazar.
            No agrega un paso de verificación por código: es solo un recordatorio
            visible para que el admin revise antes de decidir. */}
        <div
          role="alert"
          className="flex flex-col gap-1.5 rounded-14 bg-ga-ambar-fondo p-4 text-14 leading-150 text-ga-ambar-texto"
        >
          <span className="font-extrabold">Antes de aprobar</span>
          <p className="m-0">
            Confirma que el nombre del correo institucional corresponde a la persona, y que la cédula
            (frente y reverso) y la selfie son de la misma persona. Si tienes dudas, contáctala por
            WhatsApp antes de aprobar.
          </p>
        </div>
        <AccionesAfiliacion id={solicitud.id} estado={solicitud.estado} />
      </section>
    </AdminShell>
  );
}
