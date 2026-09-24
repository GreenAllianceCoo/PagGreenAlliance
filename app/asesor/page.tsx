import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EncabezadoAsesor } from "@/components/asesor/EncabezadoAsesor";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";
import { sanitizarFilaResumen, type FilaResumenAsesor } from "@/lib/asesor/resumen";
import { cerrarSesionAsesor } from "./actions";
import { ListaClientesCliente } from "./ListaClientesCliente";

export const metadata: Metadata = {
  title: "Mis clientes · Cooperativa Green Alliance",
};

/**
 * Pantalla del asesor: «Mis clientes» (spec-fase-2.md §1). Solo para
 * `rol = 'asesor'`; el resto de roles no tiene nada que ver aquí.
 * proxy.ts todavía no protege /asesor (lo agrega otro agente al matcher):
 * esta página hace la comprobación completa por su cuenta.
 */
export default async function AsesorPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, rol")
    .eq("id", user.id)
    .single();

  // No es asesor: no tiene nada que hacer en /asesor. Un asociado vuelve a
  // /cuenta; sin perfil o rol desconocido, al ingreso.
  if (perfil?.rol !== "asesor") {
    redirect(perfil ? "/cuenta" : "/ingresar");
  }

  // resumen_clientes_asesor() ya se autofiltra por auth.uid() (RLS/SECURITY
  // DEFINER) y nunca selecciona celular, correo, nequi ni fotos.
  const { data, error } = await supabase.rpc("resumen_clientes_asesor");
  if (error) {
    registrar("error", { evento: "resumen_clientes_asesor_fallo", codigo: error.code, mensaje: error.message });
  }
  const filas: FilaResumenAsesor[] = (data ?? []).map((fila: Record<string, unknown>) =>
    sanitizarFilaResumen(fila),
  );

  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      <EncabezadoAsesor nombre={perfil.nombre_completo ?? "Asesor"} accionSalir={cerrarSesionAsesor} />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-3xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-24 font-extrabold text-ga-navy lg:text-32">
            Hola, {perfil.nombre_completo ?? "Asesor"}
          </h1>
          <p className="m-0 text-15 text-ga-texto-3">
            Aquí ves el avance de las personas que has referido y de tus asociados asignados.
          </p>
        </div>

        <section
          aria-labelledby="mis-clientes-titulo"
          className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:p-7"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="mis-clientes-titulo" className="m-0 text-18 font-extrabold lg:text-20">
              Mis clientes
            </h2>
            {/* Cuenta de demostración para mostrarle la plataforma a un cliente (no guarda nada). */}
            <Link
              href="/asesor/demo"
              className="text-14 font-bold text-ga-verde no-underline hover:underline lg:text-15"
            >
              Ver cuenta de demostración
            </Link>
          </div>
          <ListaClientesCliente filas={filas} />
        </section>
      </main>
    </div>
  );
}
