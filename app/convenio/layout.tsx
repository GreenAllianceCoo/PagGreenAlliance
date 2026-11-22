import { exigirConvenio } from "@/lib/convenio/servidor";

/**
 * Panel de la empresa en convenio. Exige en cada petición rol `convenio` y
 * convenio visible (exigirConvenio); cada página y cada Server Action lo
 * vuelve a exigir, porque el layout no protege las acciones.
 */
export default async function ConvenioLayout({ children }: { children: React.ReactNode }) {
  await exigirConvenio();
  return <>{children}</>;
}
