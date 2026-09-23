import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/server";
import { formatTasa } from "@/lib/credito";

const CONVENIOS = [
  { titulo: "Hoteleria", icono: "\u{1F3E8}" },
  { titulo: "Odontologia", icono: "\u{1F9B7}" },
  { titulo: "Viajes", icono: "✈️" },
  { titulo: "Tecnologia", icono: "\u{1F4F1}" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, grado")
    .eq("id", user.id)
    .single();

  const { data: solicitudes } = await supabase
    .from("solicitudes_credito")
    .select("*")
    .eq("asociado_id", user.id)
    .order("fecha_solicitud", { ascending: false })
    .limit(1);

  const ultimaSolicitud = solicitudes?.[0];

  return (
    <main className="min-h-screen px-4 py-6 flex justify-center">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          {/* Logo oficial en vez del texto «GREEN ALLIANCE» (pantalla sin maqueta). */}
          <Link href="/" aria-label="Ir al inicio" className="block h-11 w-[200px] min-w-0">
            <Logo tone="dark" />
          </Link>
          <span className="text-sm text-gray-500">
            {perfil?.nombre_completo ?? "Asociado"}
          </span>
        </div>

        <a
          href="/dashboard/solicitar"
          className="block text-center h-14 leading-[3.5rem] bg-green text-white rounded-lg font-bold mb-5"
        >
          Solicita tu credito
        </a>

        {ultimaSolicitud ? (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-surface-muted rounded-xl p-4">
              <p className="text-xs text-gray-500 font-semibold">Valor credito</p>
              <p className="text-lg font-bold">
                ${ultimaSolicitud.monto_solicitado.toLocaleString("es-CO")}
              </p>
            </div>
            <div className="bg-surface-muted rounded-xl p-4">
              <p className="text-xs text-gray-500 font-semibold">Interes mensual</p>
              <p className="text-lg font-bold">
                {formatTasa(ultimaSolicitud.tasa_interes_mensual)}
              </p>
            </div>
            <div className="col-span-2 bg-surface-muted rounded-xl p-4">
              <p className="text-xs text-gray-500 font-semibold">Estado de la solicitud</p>
              <p className="text-lg font-bold capitalize">{ultimaSolicitud.estado}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">
            Aun no tienes solicitudes de credito activas.
          </p>
        )}

        <h2 className="text-sm font-bold text-navy mt-2 mb-3">Convenios</h2>
        <div className="flex flex-col gap-2">
          {CONVENIOS.map((convenio) => (
            <div
              key={convenio.titulo}
              className="bg-surface-muted rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <span className="text-lg">{convenio.icono}</span>
              <span className="font-semibold text-sm">{convenio.titulo}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
