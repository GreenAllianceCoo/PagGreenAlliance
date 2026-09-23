import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import SolicitudForm from "./SolicitudForm";

export default async function SolicitarPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("grado")
    .eq("id", user.id)
    .single();

  const { data: solicitudes } = await supabase
    .from("solicitudes_credito")
    .select("estado")
    .eq("asociado_id", user.id)
    .order("fecha_solicitud", { ascending: false })
    .limit(1);

  const tienePendiente = solicitudes?.[0]?.estado === "pendiente";

  const { data: paquetes } = perfil?.grado
    ? await supabase
        .from("grados_credito")
        .select("porcentaje, capacidad_maxima, tasa_interes_mensual, plazo_meses")
        .eq("grado", perfil.grado)
        .order("porcentaje", { ascending: true })
    : { data: null };

  return (
    <main className="min-h-screen px-4 py-6 flex justify-center">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          {/* Logo oficial en vez del texto «GREEN ALLIANCE» (pantalla sin maqueta). */}
          <Link href="/" aria-label="Ir al inicio" className="block h-11 w-[200px] min-w-0">
            <Logo tone="dark" />
          </Link>
          <Link href="/cuenta" className="text-sm text-gray-500">
            Volver
          </Link>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-5">Solicita tu credito</h1>

        {!perfil?.grado ? (
          <p className="text-sm text-gray-500">
            Tu perfil aun no tiene un grado asignado. Contacta al administrador
            para poder solicitar un credito.
          </p>
        ) : tienePendiente ? (
          <p className="text-sm text-gray-500">
            Ya tienes una solicitud pendiente de revision. Espera la respuesta
            antes de enviar una nueva.
          </p>
        ) : !paquetes || paquetes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Aun no hay topes de credito configurados para tu grado. Contacta al
            administrador.
          </p>
        ) : (
          <SolicitudForm paquetes={paquetes} />
        )}
      </div>
    </main>
  );
}
