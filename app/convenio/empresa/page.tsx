import type { Metadata } from "next";
import { FormularioEmpresa } from "@/components/convenio/FormularioEmpresa";
import { MarcoConvenio } from "@/components/convenio/MarcoConvenio";
import { exigirConvenio, obtenerFichaPropia, pasosFicha } from "@/lib/convenio/servidor";

export const metadata: Metadata = { title: "Mi empresa · Panel del convenio · Green Alliance" };

/** La empresa edita su ficha (lo que ven los asociados en Convenios). Nombre y NIT siguen en manos del admin. */
export default async function EmpresaPage() {
  const { supabase, convenio } = await exigirConvenio();
  const ficha = await obtenerFichaPropia(supabase, convenio.id);
  const pasos = ficha ? pasosFicha(ficha) : [];
  const hechos = pasos.filter((p) => p.listo).length;

  return (
    <MarcoConvenio
      nombre={convenio.nombre}
      logoUrl={convenio.logoUrl}
      seccion="empresa"
      hero={
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 font-display text-30 font-semibold leading-tight lg:text-34">Mi empresa</h1>
            <p className="m-0 max-w-xl text-16 leading-150 text-ga-menta-suave">
              Así te presentas ante los asociados. Lo que guardes aquí se ve de inmediato en Convenios.
            </p>
          </div>
          {ficha ? (
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-14 font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]">
              Ficha {hechos === pasos.length ? "completa" : `${hechos} de ${pasos.length} lista`}
            </span>
          ) : null}
        </div>
      }
    >
      {ficha ? (
        <FormularioEmpresa ficha={ficha} />
      ) : (
        <p role="alert" className="m-0 rounded-24 bg-white p-6 text-15 font-semibold text-ga-error-texto">
          No pudimos cargar los datos de tu empresa. Recarga la página.
        </p>
      )}
    </MarcoConvenio>
  );
}
