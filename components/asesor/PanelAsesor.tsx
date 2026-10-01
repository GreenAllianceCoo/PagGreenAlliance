"use client";

import Link from "next/link";
import { useState } from "react";
import type { EstadoAcumulado, EstadoBuscarCliente } from "@/app/asesor/actions";
import { PremiosAsesor } from "@/components/asesor/PremiosAsesor";
import { BuscarClientePorCedula } from "@/components/asesor/BuscarClientePorCedula";
import { EncabezadoAsesor } from "@/components/asesor/EncabezadoAsesor";
import { ResumenAsesor } from "@/components/asesor/ResumenAsesor";
import { PanelComisiones } from "@/components/asesor/PanelComisiones";
import { ListaClientesCliente } from "@/app/asesor/ListaClientesCliente";
import { BarraInferior } from "@/components/ui/BarraInferior";
import { cx } from "@/components/ui/cx";
import type { VistaComisiones } from "@/lib/asesor/comisiones";
import type { MetricasAsesor } from "@/lib/asesor/metricas";
import type { MetaPremio, VistaPremios } from "@/lib/asesor/premios";
import type { FilaResumenAsesor } from "@/lib/asesor/resumen";

type Pestana = "resumen" | "clientes" | "comisiones";

type PanelAsesorProps = {
  nombre: string;
  filas: FilaResumenAsesor[];
  comisiones: VistaComisiones | null;
  /** Conteos de la pestaña «Resumen» (4.8); null = no se pudieron cargar. */
  metricas: MetricasAsesor | null;
  /** Premios por cantidad de asociados (null = no se pudieron cargar). */
  premios?: VistaPremios | null;
  /** `registrarClicPremios` (app/asesor/actions.ts). */
  registrarClic?: (meta?: MetaPremio) => Promise<void>;
  accionSalir?: (formData: FormData) => void;
  /** `revelarAcumulado` (app/asesor/actions.ts). */
  revelar: () => Promise<EstadoAcumulado>;
  /** `buscarCliente` (app/asesor/actions.ts). */
  buscar: (previo: EstadoBuscarCliente, formData: FormData) => Promise<EstadoBuscarCliente>;
};

const RUTA_SIMULADOR = "/asesor/demo";

/**
 * Panel del asesor (piezas 2c y 3l): pestañas «Mis clientes» (lista + búsqueda por cédula)
 * y «Comisiones». Es una sola pantalla: un solo <h1> visible a la vez.
 */
export function PanelAsesor({ nombre, filas, comisiones, metricas, premios = null, registrarClic, accionSalir, revelar, buscar }: PanelAsesorProps) {
  const [pestana, setPestana] = useState<Pestana>("resumen");

  return (
    <div className="min-h-dvh bg-ga-fondo-suave pb-24 lg:pb-0">
      <EncabezadoAsesor
        nombre={nombre}
        accionSalir={accionSalir}
        hrefDemo={RUTA_SIMULADOR}
        pestana={pestana}
        onPestana={setPestana}
      />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-3xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        {pestana === "resumen" ? (
          <>
            <div className="flex flex-col gap-0.5 lg:gap-1.5">
              <span className="text-15 text-ga-texto-3 lg:hidden">Hola, {nombre}</span>
              <h1 className="m-0 font-display text-30 font-extrabold tracking-titular text-ga-navy lg:text-44">Resumen</h1>
            </div>
            <ResumenAsesor metricas={metricas} comisiones={comisiones} onIrAComisiones={() => setPestana("comisiones")} />
            {registrarClic ? <PremiosAsesor premios={premios} registrarClic={registrarClic} /> : null}
          </>
        ) : pestana === "clientes" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5 lg:gap-1.5">
                <span className="text-15 text-ga-texto-3 lg:hidden">Hola, {nombre}</span>
                <h1 className="m-0 font-display text-30 font-extrabold tracking-titular text-ga-navy lg:text-44">
                  Mis clientes
                </h1>
                <p className="m-0 hidden text-17 text-ga-texto-2 lg:block">
                  Las personas que referiste y los asociados que la cooperativa te asignó.
                </p>
              </div>
              {/* Celular: acceso condensado a la cuenta de demostración (en escritorio vive en el encabezado). */}
              <Link
                href={RUTA_SIMULADOR}
                className="inline-flex h-11 shrink-0 items-center rounded-full bg-ga-ambar-fondo px-3.5 text-14 font-extrabold text-ga-ambar-texto no-underline lg:hidden"
              >
                Demo
              </Link>
            </div>

            <BuscarClientePorCedula accion={buscar} />
            <ListaClientesCliente filas={filas} />

            <p className="m-0 flex items-center gap-2.5 text-14 text-ga-texto-2 lg:text-15">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-ga-verde" />
              Por la privacidad de tus clientes, aquí no se muestran celular, correo, Nequi ni fotos.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-0.5 lg:gap-1.5">
              <span className="text-15 text-ga-texto-3 lg:hidden">Hola, {nombre}</span>
              <h1 className="m-0 font-display text-30 font-extrabold tracking-titular text-ga-navy lg:text-44">
                Comisiones
              </h1>
            </div>
            <PanelComisiones comisiones={comisiones} revelar={revelar} hrefSimulador={RUTA_SIMULADOR} />
          </>
        )}
      </main>

      <BarraInferior>
        <nav
          aria-label="Navegación del asesor"
          className="grid grid-cols-4 gap-1 rounded-full bg-white p-1.5 shadow-comprobante-movil"
        >
          {(["resumen", "clientes", "comisiones"] as const).map((clave) => (
            <button
              key={clave}
              type="button"
              aria-current={pestana === clave ? "page" : undefined}
              onClick={() => setPestana(clave)}
              className={cx(
                "flex h-13 items-center justify-center rounded-full text-13",
                pestana === clave ? "bg-ga-verde-claro font-extrabold text-ga-verde-oscuro" : "font-bold text-ga-texto-3",
              )}
            >
              {clave === "resumen" ? "Resumen" : clave === "clientes" ? "Clientes" : "Comisiones"}
            </button>
          ))}
          <form action={accionSalir} className="contents">
            <button type="submit" className="flex h-13 items-center justify-center rounded-full text-13 font-bold text-ga-texto-3">
              Salir
            </button>
          </form>
        </nav>
      </BarraInferior>
    </div>
  );
}
