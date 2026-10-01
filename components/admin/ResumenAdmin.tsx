import Link from "next/link";
import { TarjetaKpi } from "@/components/admin/TarjetaKpi";
import { formatearPesos } from "@/lib/cuenta";
import { GRUPOS_CREDITO } from "@/lib/gradosCatalogo";
import type { MetricasAdmin } from "@/lib/admin/metricas";
import { ESTADOS_PROCESO, ETIQUETA_ESTADO_PROCESO } from "@/lib/procesoEjecutivo";
import { nombreInstitucion } from "@/lib/validaciones/instituciones";

type Props = {
  /** null = no se pudo cargar (no es admin o falló la RPC): estado de error. */
  metricas: MetricasAdmin | null;
  alertasPendientes: number;
};

/** Barra de relleno animada con `transform` (scaleX); sin movimiento con prefers-reduced-motion (globals.css). */
function Relleno({ parte, indice, clase = "bg-admin-verde" }: { parte: number; indice: number; clase?: string }) {
  return (
    <div
      className={`h-full origin-left rounded-full motion-safe:animate-ga-barra ${clase}`}
      style={{ width: `${Math.max(0, Math.min(100, parte))}%`, animationDelay: `${indice * 60}ms` }}
    />
  );
}

/** Pieza 3r (4.7): «Resumen de clientes». Solo cifras agregadas, sin datos personales ni tasa. */
export function ResumenAdmin({ metricas, alertasPendientes }: Props) {
  const encabezado = (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Resumen de clientes</h1>
      <span className="text-14 text-admin-texto-3">Cifras del mes en curso</span>
    </div>
  );

  if (!metricas) {
    return (
      <>
        {encabezado}
        <p role="alert" className="m-0 flex flex-col items-start gap-3 rounded-20 bg-admin-superficie p-5 text-15 text-admin-rojo-2">
          No pudimos cargar el resumen. Intenta de nuevo.
          <Link
            href="/admin"
            className="inline-flex h-11 items-center rounded-full px-5 text-14 font-bold text-admin-texto no-underline shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie-2"
          >
            Reintentar
          </Link>
        </p>
      </>
    );
  }

  const grados = Object.entries(metricas.asociadosPorGrado).sort(([a], [b]) => {
    const ia = (GRUPOS_CREDITO as readonly string[]).indexOf(a);
    const ib = (GRUPOS_CREDITO as readonly string[]).indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  });
  const maxGrado = Math.max(1, ...grados.map(([, n]) => n));
  const instituciones = Object.entries(metricas.asociadosPorInstitucion).filter(([, n]) => n > 0);
  const totalInst = instituciones.reduce((s, [, n]) => s + n, 0);

  return (
    <>
      {encabezado}

      <section aria-label="Cifras principales" className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <TarjetaKpi etiqueta="Asociados activos" valor={metricas.asociadosActivos} />
        <TarjetaKpi etiqueta="Afiliaciones pendientes" valor={metricas.afiliacionesPendientes} tono="ambar" />
        <TarjetaKpi etiqueta="Créditos pendientes" valor={metricas.creditosPendientes} tono="ambar" />
        <Link href="/admin/sorteo" className="flex flex-col no-underline [&>div]:flex-1">
          <TarjetaKpi etiqueta="Inscritos al sorteo del mes" valor={metricas.inscritosSorteoMes} />
        </Link>
        <TarjetaKpi
          etiqueta="Desembolsos del mes"
          valor={metricas.desembolsosMes.conteo}
          nota={formatearPesos(metricas.desembolsosMes.monto)}
          tono="verde"
        />
      </section>

      {metricas.asociadosActivos === 0 ? (
        <p className="m-0 rounded-20 bg-admin-superficie p-5 text-15 text-admin-texto-3">Todavía no hay asociados activos.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section aria-labelledby="por-grado" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5">
            <h2 id="por-grado" className="m-0 font-display text-18 font-extrabold">Asociados por grado</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {grados.map(([grado, n], i) => (
                <li key={grado} className="grid grid-cols-[3.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-14">
                  <span className="font-bold text-admin-texto-2">{grado === "sin_grado" ? "Sin grado" : grado}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-admin-superficie-2" aria-hidden="true">
                    <Relleno parte={(n / maxGrado) * 100} indice={i} />
                  </div>
                  <span className="text-right font-extrabold">{n}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex flex-col gap-4">
            <section aria-labelledby="por-institucion" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5">
              <h2 id="por-institucion" className="m-0 font-display text-18 font-extrabold">Por institución</h2>
              <div className="flex h-3 gap-1 overflow-hidden rounded-full" aria-hidden="true">
                {instituciones.map(([inst, n], i) => (
                  <div key={inst} style={{ width: `${(n / totalInst) * 100}%` }} className="h-full">
                    <Relleno parte={100} indice={i} clase={i === 0 ? "bg-admin-verde" : "bg-admin-ambar"} />
                  </div>
                ))}
              </div>
              <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-14">
                {instituciones.map(([inst, n]) => (
                  <li key={inst}>
                    {nombreInstitucion(inst) ?? inst} · <strong>{n}</strong>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="alertas-resumen" className="flex flex-col gap-2 rounded-20 bg-admin-superficie p-5">
              <h2 id="alertas-resumen" className="m-0 font-display text-18 font-extrabold">
                Alertas pendientes · {alertasPendientes}
              </h2>
              <Link href="/admin/alertas" className="text-14 font-bold text-admin-verde-2 no-underline hover:underline">
                Ir a Alertas →
              </Link>
            </section>
          </div>
        </div>
      )}

      <section aria-labelledby="por-estado" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5">
        <h2 id="por-estado" className="m-0 font-display text-18 font-extrabold">Procesos por estado</h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-8">
          {ESTADOS_PROCESO.map((estado, i) => (
            <li
              key={estado}
              style={{ animationDelay: `${i * 40}ms` }}
              className="flex flex-col gap-0.5 rounded-16 bg-admin-superficie-2 px-3 py-2.5 motion-safe:animate-ga-tarjeta-entra"
            >
              <span className="font-display text-24 font-extrabold leading-none">{metricas.porEstadoProceso[estado] ?? 0}</span>
              <span className="text-13 text-admin-texto-3">{ETIQUETA_ESTADO_PROCESO[estado]}</span>
            </li>
          ))}
        </ul>
        {(metricas.porEstadoProceso.sin_proceso ?? 0) > 0 ? (
          <span className="text-13 text-admin-texto-3">Sin proceso: {metricas.porEstadoProceso.sin_proceso}</span>
        ) : null}
      </section>
    </>
  );
}
