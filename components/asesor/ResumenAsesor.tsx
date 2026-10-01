import { BarraBono } from "@/components/asesor/PanelComisiones";
import { ESTADOS_PROCESO, ETIQUETA_ESTADO_PROCESO } from "@/lib/procesoEjecutivo";
import type { VistaComisiones } from "@/lib/asesor/comisiones";
import type { MetricasAsesor } from "@/lib/asesor/metricas";

type Props = {
  /** null = no se pudo cargar (el asesor no atiende hoy o falló la RPC). */
  metricas: MetricasAsesor | null;
  /** Mismos datos de la pestaña Comisiones: el avance a bonos no se recalcula aquí. */
  comisiones: VistaComisiones | null;
  onIrAComisiones: () => void;
};

function Tarjeta({ titulo, cifra, nota, indice }: { titulo: string; cifra: number; nota: string; indice: number }) {
  return (
    <div
      style={{ animationDelay: `${indice * 70}ms` }}
      className="flex flex-col gap-1 rounded-20 bg-white px-4.5 py-4 motion-safe:animate-ga-tarjeta-entra lg:gap-2 lg:rounded-26 lg:px-6 lg:py-5.5"
    >
      <span className="text-13 text-ga-texto-3 lg:text-14">{titulo}</span>
      <span className="font-display text-32 font-extrabold leading-none text-ga-navy lg:text-[52px]">{cifra}</span>
      <span className="text-13 text-ga-texto-2 lg:text-15">{nota}</span>
    </div>
  );
}

/**
 * Pestaña «Resumen» del asesor (pieza 3s, 4.8): solo conteos de SU cartera, sin
 * celular, correo, Nequi ni fotos. El avance a bonos reutiliza `BarraBono` de Comisiones.
 */
export function ResumenAsesor({ metricas, comisiones, onIrAComisiones }: Props) {
  if (!metricas) {
    return (
      <p role="alert" className="m-0 rounded-16 bg-white p-5 text-15 text-ga-texto-2">
        No pudimos cargar tu resumen. Intenta de nuevo en un momento.
      </p>
    );
  }
  if (metricas.clientesTotal === 0 && metricas.afiliacionesReferidasMes === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-20 bg-white p-6 text-center">
        <p className="m-0 font-display text-18 font-extrabold text-ga-navy">Sin clientes todavía</p>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">Cuando alguien se afilie con tu nombre, lo verás aquí.</p>
      </div>
    );
  }
  const pendientesAfil = metricas.afiliacionesPorEstado.pendiente ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <Tarjeta indice={0} titulo="Mis clientes" cifra={metricas.clientesTotal} nota="asociados y solicitudes en tu cartera" />
        <Tarjeta indice={1} titulo="Créditos pendientes" cifra={metricas.creditosPendientes} nota="de tus clientes, en revisión" />
        <Tarjeta
          indice={2}
          titulo="Afiliaciones referidas"
          cifra={metricas.afiliacionesReferidasMes}
          nota={`este mes · ${pendientesAfil} pendiente${pendientesAfil === 1 ? "" : "s"} de contactar`}
        />
      </div>

      <section aria-labelledby="resumen-estados" className="flex flex-col gap-3 rounded-20 bg-white p-5 lg:rounded-26 lg:px-6 lg:py-6">
        <h2 id="resumen-estados" className="m-0 text-14 font-extrabold uppercase tracking-[0.04em] text-ga-texto-3">
          Procesos de tu cartera
        </h2>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {ESTADOS_PROCESO.map((estado) => {
            const n = metricas.porEstadoProceso[estado] ?? 0;
            return (
              <li
                key={estado}
                className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3.5 text-14 font-bold ${
                  n > 0 ? "bg-ga-verde-tint text-ga-verde-oscuro" : "bg-ga-fondo-suave text-ga-texto-3"
                }`}
              >
                {ETIQUETA_ESTADO_PROCESO[estado]}
                <span className="font-extrabold">{n}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {comisiones ? (
        <section aria-labelledby="resumen-bonos" className="flex flex-col gap-3.5 rounded-20 bg-white p-5 lg:rounded-26 lg:px-6 lg:py-6">
          <h2 id="resumen-bonos" className="m-0 text-14 font-extrabold uppercase tracking-[0.04em] text-ga-texto-3">
            Avance hacia los bonos
          </h2>
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
            <BarraBono titulo="Bono de $1.000.000" avance={comisiones.bono50} />
            <BarraBono titulo="Viaje a San Andrés" avance={comisiones.viaje100} />
          </div>
          <button
            type="button"
            onClick={onIrAComisiones}
            className="inline-flex min-h-11 items-center self-start text-15 font-bold text-ga-verde hover:underline"
          >
            Ver Comisiones →
          </button>
        </section>
      ) : null}
    </>
  );
}
