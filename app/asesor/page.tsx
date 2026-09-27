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
    <div className="min-h-dvh bg-ga-fondo-suave pb-24 lg:pb-0">
      <EncabezadoAsesor
        nombre={perfil.nombre_completo ?? "Asesor"}
        accionSalir={cerrarSesionAsesor}
        hrefDemo="/asesor/demo"
      />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-3xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5 lg:gap-1.5">
            <span className="text-15 text-ga-texto-3 lg:hidden">Hola, {perfil.nombre_completo ?? "Asesor"}</span>
            <h1 className="m-0 font-display text-30 font-extrabold tracking-titular text-ga-navy lg:text-44">
              Mis clientes
            </h1>
            <p className="m-0 hidden text-17 text-ga-texto-2 lg:block">
              Las personas que referiste y los asociados que la cooperativa te asignó.
            </p>
          </div>
          {/* Celular: acceso condensado a la cuenta de demostración (en escritorio vive en el encabezado). */}
          <Link
            href="/asesor/demo"
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-ga-ambar-fondo px-3.5 text-14 font-extrabold text-ga-ambar-texto no-underline lg:hidden"
          >
            Demo
          </Link>
        </div>

        <ListaClientesCliente filas={filas} />

        <p className="m-0 flex items-center gap-2.5 text-14 text-ga-texto-2 lg:text-15">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-ga-verde" />
          Por la privacidad de tus clientes, aquí no se muestran celular, correo, Nequi ni fotos.
        </p>
      </main>

      <BarraInferiorAsesor accionSalir={cerrarSesionAsesor} />
    </div>
  );
}

/**
 * Barra inferior flotante de celular (pieza 2c, mockup de 390 px): en
 * escritorio «Mis clientes» y «Salir» ya viven en el encabezado en píldora;
 * en celular ese encabezado se reduce solo al logo (ver EncabezadoAsesor),
 * así que esta barra los reemplaza. Mismo patrón que `BarraInferiorCuenta`
 * de components/pantallas/Cuenta.tsx (que no se puede editar).
 */
function BarraInferiorAsesor({ accionSalir }: { accionSalir?: (formData: FormData) => void }) {
  return (
    <nav
      aria-label="Navegación del asesor"
      className="fixed inset-x-4 bottom-4 z-30 grid grid-cols-2 gap-1 rounded-full bg-white p-1.5 shadow-comprobante-movil lg:hidden"
    >
      <span className="flex h-13 items-center justify-center rounded-full bg-ga-verde-claro text-13 font-extrabold text-ga-verde-oscuro">
        Clientes
      </span>
      <form action={accionSalir} className="contents">
        <button type="submit" className="flex h-13 items-center justify-center rounded-full text-13 font-bold text-ga-texto-3">
          Salir
        </button>
      </form>
    </nav>
  );
}
