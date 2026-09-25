"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConvenioCard } from "@/components/ui/ConvenioCard";
import { IconoCheck, IconoVolver } from "@/components/ui/Iconos";
import { EncabezadoAsesor } from "@/components/asesor/EncabezadoAsesor";
import { CONVENIOS } from "@/lib/convenios";
import {
  CLIENTE_DEMO,
  GRADOS,
  MONTO_MINIMO,
  NOMBRE_GRADO,
  topeMaximoDemo,
  type CodigoGrado,
  type PaqueteDemo,
} from "@/lib/asesor/datosDemo";

const PASO_MONTO = 50000;

function formatCOP(valor: number) {
  return `$ ${Math.round(valor).toLocaleString("es-CO")}`;
}

type CuentaDemoProps = {
  nombreAsesor: string;
  /** `grados_credito` agrupado por grado (de la base si se pudo leer; si no, la copia de lib/asesor/datosDemo.ts). */
  paquetesPorGrado: Record<CodigoGrado, PaqueteDemo[]>;
  /** Server Action de «Salir» (misma del resto de /asesor). */
  accionSalir?: (formData: FormData) => void;
  /** Encabezado propio (p. ej. el de /admin); si falta, el del asesor. */
  encabezado?: ReactNode;
  /** A dónde vuelven la flecha y el botón, con su texto (por defecto, «Volver a Mis clientes» → /asesor). */
  volver?: { href: string; texto: string };
};

const VOLVER_ASESOR = { href: "/asesor", texto: "Volver a Mis clientes" };

/**
 * Cuenta de demostración del asesor (spec-fase-2.md §5): «se ve igual que
 * /cuenta de un asociado, con datos de ejemplo». No hay maqueta propia: usa
 * los mismos tokens y tarjetas que Cuenta.tsx (que no se puede editar), en
 * un componente nuevo. NUNCA llama a Supabase: es 100% estado local.
 */
export function CuentaDemo({
  nombreAsesor,
  paquetesPorGrado,
  accionSalir,
  encabezado,
  volver = VOLVER_ASESOR,
}: CuentaDemoProps) {
  const gradosDisponibles = GRADOS.filter((g) => (paquetesPorGrado[g]?.length ?? 0) > 0);
  const [grado, setGrado] = useState<CodigoGrado>(gradosDisponibles[0] ?? "PP");
  const paquetes = useMemo(() => paquetesPorGrado[grado] ?? [], [paquetesPorGrado, grado]);
  const tope = topeMaximoDemo(paquetes);

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [porcentaje, setPorcentaje] = useState<"50" | "100">(paquetes[0]?.porcentaje ?? "50");
  const paquete = useMemo(
    () => paquetes.find((p) => p.porcentaje === porcentaje) ?? paquetes[0],
    [paquetes, porcentaje],
  );
  const [monto, setMonto] = useState(paquete?.capacidad_maxima ?? MONTO_MINIMO);
  const [enviando, setEnviando] = useState(false);
  const [confirmada, setConfirmada] = useState(false);

  function cambiarGrado(nuevo: CodigoGrado) {
    setGrado(nuevo);
    const nuevosPaquetes = paquetesPorGrado[nuevo] ?? [];
    const nuevoPorcentaje = nuevosPaquetes[0]?.porcentaje ?? "50";
    setPorcentaje(nuevoPorcentaje);
    setMonto(nuevosPaquetes[0]?.capacidad_maxima ?? MONTO_MINIMO);
    setConfirmada(false);
  }

  function elegirPorcentaje(p: PaqueteDemo) {
    setPorcentaje(p.porcentaje);
    setMonto(p.capacidad_maxima);
  }

  // Nada de esto llama a Supabase ni inserta: es una confirmación simulada.
  function enviarSolicitudDemo() {
    setEnviando(true);
    setTimeout(() => {
      setEnviando(false);
      setConfirmada(true);
    }, 500);
  }

  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      {encabezado ?? <EncabezadoAsesor nombre={nombreAsesor} accionSalir={accionSalir} />}

      {/* Franja de modo demostración: visible en toda la pantalla. */}
      <p className="m-0 bg-ga-navy px-5 py-2.5 text-center text-14 font-bold text-white lg:text-15">
        Modo demostración: nada se guarda
      </p>

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-2xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <div className="flex items-center gap-3">
          <Link
            href={volver.href}
            aria-label={volver.texto}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ga-navy"
          >
            <IconoVolver tamano={22} grosor={1.8} />
          </Link>
          <h1 className="m-0 flex flex-col gap-0.5 font-extrabold text-ga-navy lg:block lg:text-32">
            <span className="text-15 font-normal text-ga-texto-3 lg:text-32 lg:font-extrabold lg:text-ga-navy">
              Hola,
            </span>{" "}
            <span className="text-24 lg:text-32">{CLIENTE_DEMO.nombre}</span>
          </h1>
        </div>

        <label className="flex flex-col gap-1.5 rounded-18 bg-white p-5 lg:p-6">
          <span className="text-15 font-bold">Grado del cliente</span>
          <Select
            value={grado}
            onChange={(e) => cambiarGrado(e.target.value as CodigoGrado)}
            aria-label="Grado del cliente"
            className="lg:max-w-xs"
          >
            {gradosDisponibles.map((g) => (
              <option key={g} value={g}>
                {NOMBRE_GRADO[g]}
              </option>
            ))}
          </Select>
        </label>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
          <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:col-span-2 lg:gap-5.5 lg:p-7">
            {!mostrarFormulario ? (
              <>
                <h2 className="m-0 text-18 font-extrabold lg:text-20">Tu solicitud</h2>
                <p className="m-0 text-15 leading-150 text-ga-texto-2">
                  Así ve el cliente su cuenta antes de pedir un crédito. Prueba «Nueva solicitud».
                </p>
                <Button onClick={() => setMostrarFormulario(true)} className="gap-2 lg:self-start lg:px-9">
                  Nueva solicitud
                </Button>
              </>
            ) : confirmada ? (
              <div className="flex flex-col items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde"
                >
                  <IconoCheck tamano={24} grosor={2} />
                </span>
                <h2 className="m-0 text-18 font-extrabold lg:text-20">Solicitud de ejemplo enviada</h2>
                <p className="m-0 text-15 leading-150 text-ga-texto-2">
                  Esto es una simulación: no se guardó ninguna solicitud real. Monto de ejemplo{" "}
                  {formatCOP(monto)} al {porcentaje}%.
                </p>
                <Button
                  variante="secundario"
                  onClick={() => {
                    setConfirmada(false);
                    setMostrarFormulario(false);
                  }}
                  className="lg:px-9"
                >
                  Volver
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarSolicitudDemo();
                }}
              >
                <h2 className="m-0 text-18 font-extrabold lg:text-20">Solicita tu crédito</h2>
                <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
                  <legend className="mb-1.5 p-0 text-15 font-bold">Porcentaje de devolución</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {paquetes.map((p) => (
                      <label key={p.porcentaje} className="cursor-pointer">
                        <input
                          type="radio"
                          name="porcentaje-demo"
                          value={p.porcentaje}
                          checked={porcentaje === p.porcentaje}
                          onChange={() => elegirPorcentaje(p)}
                          className="peer sr-only"
                        />
                        <span className="flex min-h-13.5 items-center justify-center rounded-12 border-1.5 border-ga-borde bg-white px-3 py-2 text-center text-16 font-extrabold leading-tight text-ga-texto transition-colors peer-checked:border-ga-verde peer-checked:bg-ga-verde-tint peer-checked:text-ga-verde">
                          {p.porcentaje}% de devolución
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {paquete ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor="monto-demo" className="text-15 font-bold">
                        Monto a desembolsar
                      </label>
                      <output htmlFor="monto-demo" className="text-24 font-extrabold text-ga-navy">
                        {formatCOP(monto)}
                      </output>
                    </div>
                    <input
                      id="monto-demo"
                      type="range"
                      min={Math.min(MONTO_MINIMO, paquete.capacidad_maxima)}
                      max={paquete.capacidad_maxima}
                      step={PASO_MONTO}
                      value={monto}
                      onChange={(e) => setMonto(Number(e.target.value))}
                      aria-valuetext={formatCOP(monto)}
                      className="h-11 w-full accent-ga-verde"
                    />
                    <div className="flex justify-between text-13 text-ga-texto-3">
                      <span>Mínimo {formatCOP(Math.min(MONTO_MINIMO, paquete.capacidad_maxima))}</span>
                      <span>Tope {formatCOP(paquete.capacidad_maxima)}</span>
                    </div>
                  </div>
                ) : null}

                {paquete ? (
                  <dl className="m-0 grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
                      <dt className="text-14 text-ga-texto-3">Plazo</dt>
                      <dd className="m-0 text-16 font-bold text-ga-texto">{paquete.plazo_meses} meses</dd>
                    </div>
                  </dl>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button cargando={enviando} textoCargando="Enviando…" className="lg:self-start lg:px-9">
                    Enviar solicitud de ejemplo
                  </Button>
                  <Button
                    type="button"
                    variante="secundario"
                    onClick={() => setMostrarFormulario(false)}
                    className="lg:self-start lg:px-9"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1.5 rounded-18 bg-ga-navy p-5 text-white lg:p-6">
              <span className="text-14 text-ga-navy-texto-suave">Tope disponible para el grado {NOMBRE_GRADO[grado]}</span>
              <span className="text-26 font-extrabold lg:text-30">{formatCOP(tope)}</span>
            </section>
            <ButtonLink href={volver.href} variante="terciario" className="gap-2">
              {volver.texto}
            </ButtonLink>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:px-7 lg:py-6">
          <h2 className="m-0 text-18 font-extrabold">Convenios de ejemplo</h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5">
            {CONVENIOS.map((convenio) => (
              <ConvenioCard key={convenio.nombre} convenio={convenio} variante="enlace" href="#" />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:px-7 lg:py-6">
          <h2 className="m-0 text-18 font-extrabold">Datos del cliente (ejemplo)</h2>
          <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
              <dt className="text-14 text-ga-texto-3">Nombre</dt>
              <dd className="m-0 text-16 font-bold text-ga-texto">{CLIENTE_DEMO.nombre}</dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
              <dt className="text-14 text-ga-texto-3">Cédula</dt>
              <dd className="m-0 text-16 font-bold text-ga-texto">{CLIENTE_DEMO.cedula}</dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
              <dt className="text-14 text-ga-texto-3">Grado</dt>
              <dd className="m-0 text-16 font-bold text-ga-texto">{NOMBRE_GRADO[grado]}</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
