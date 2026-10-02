"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Field } from "@/components/ui/Field";
import { IconoCheck } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { LineaProceso } from "@/components/ui/LineaProceso";
import { Modal } from "@/components/ui/Modal";
import { WHATSAPP_URL } from "@/lib/config";
import type { EstadoAlertaAsociado } from "@/app/cuenta/actions-proceso";
import type { ConteoCredito } from "@/lib/cuenta";
import {
  MESES_HABILITA_RENOVACION,
  MESES_EMBARGO,
  MENSAJE_ALERTA_ENVIADA,
  TEXTO_COBRO_RETIRO_ANTICIPADO,
  TEXTO_ANTES_DE_OPERANDO,
  TEXTO_SIN_PROCESO,
  type VistaProcesoEjecutivo,
} from "@/lib/procesoEjecutivo";

export type AccionAlerta = (previo: EstadoAlertaAsociado) => Promise<EstadoAlertaAsociado>;

export type PerfilCuentaProps = {
  nombre: string;
  cedula: string;
  /** «Teniente» (el código solo si el catálogo no lo conoce). */
  grado: string;
  institucion: string | null;
  asesorNombre: string | null;
  proceso: VistaProcesoEjecutivo;
  /** Mes en curso del embargo (solo con conteo). */
  camino?: { mesActual: number; totalMeses: number; fechaInicio: string; fechaFin: string };
  /** Conteo del crédito aprobado (3 meses, spec R-07) y su plazo. */
  conteoCredito: ConteoCredito | null;
  plazoCreditoMeses: number;
  // «Mis datos» fusionado en «Perfil»: el celular sigue siendo el único dato editable.
  telefono: string;
  errorTelefono?: string;
  guardandoTelefono?: boolean;
  accionTelefono?: (formData: FormData) => void;
  mensajeTelefono?: string;
  /** `pedirRetiroAnticipado` (app/cuenta/actions-proceso.ts). */
  accionRetiro?: AccionAlerta;
  /** `pedirRenovacion` (app/cuenta/actions-proceso.ts). */
  accionRenovacion?: AccionAlerta;
};

const ESTADO_ALERTA_INICIAL: EstadoAlertaAsociado = {};

const CLASE_TARJETA_DATO = "flex min-w-0 flex-col gap-0.5 rounded-14 bg-white px-3.5 py-3 lg:rounded-16 lg:px-4.5 lg:py-4";

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className={CLASE_TARJETA_DATO}>
      <dt className="text-13 text-ga-texto-3">{etiqueta}</dt>
      <dd className="m-0 break-words text-15 font-extrabold text-ga-texto lg:text-17">{valor}</dd>
    </div>
  );
}

const BOTON_DESHABILITADO =
  "flex h-12.5 cursor-not-allowed items-center justify-center rounded-full bg-ga-linea-suave px-5 text-15 font-extrabold text-ga-deshabilitado-texto";

/** Modal «¿Seguro que quieres el retiro anticipado?»: explicación → enviado. Sin ninguna suma calculada. */
function ModalRetiro({
  abierto,
  onCerrar,
  accion,
  onEnviado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  accion: AccionAlerta;
  onEnviado: () => void;
}) {
  const idTitulo = useId();
  const [estado, despachar, enviando] = useActionState(
    async (previo: EstadoAlertaAsociado) => {
      const resultado = await accion(previo);
      if (resultado.ok) onEnviado();
      return resultado;
    },
    ESTADO_ALERTA_INICIAL,
  );

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={idTitulo} anchoClassName="lg:max-w-[440px]">
      {estado.ok ? (
        <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-ga-aparecer">
          <span className="self-start text-12 font-extrabold uppercase text-ga-texto-3">Enviado</span>
          <span
            aria-hidden="true"
            className="flex h-13 w-13 items-center justify-center rounded-full bg-ga-verde-claro text-ga-verde"
          >
            <IconoCheck tamano={26} grosor={3} />
          </span>
          <h2 id={idTitulo} role="status" className="m-0 font-display text-18 font-extrabold text-ga-navy">
            {estado.mensaje ?? MENSAJE_ALERTA_ENVIADA}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-full border-1.5 border-ga-navy bg-white text-14 font-extrabold text-ga-navy hover:bg-ga-fondo-suave"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form action={despachar} className="flex flex-col gap-3.5">
          <span className="text-12 font-extrabold uppercase text-ga-texto-3">Explicación</span>
          <h2 id={idTitulo} className="m-0 pr-8 font-display text-18 font-extrabold text-ga-navy">
            ¿Seguro que quieres el retiro anticipado?
          </h2>
          <div className="flex flex-col gap-1 rounded-14 bg-ga-error-fondo px-4 py-3.5">
            <span className="text-13 font-bold text-ga-error-texto">Cobro por desconexión del servicio</span>
            <span className="font-display text-28 font-extrabold text-ga-error-texto">
              {TEXTO_COBRO_RETIRO_ANTICIPADO}
            </span>
          </div>
          <p className="m-0 text-14 leading-150 text-ga-texto-2">
            Terminar antes de los {MESES_EMBARGO} meses tiene este cobro, según la cláusula del contrato.
          </p>
          {estado.error ? (
            <p role="alert" className="m-0 text-13 font-semibold text-ga-error">
              {estado.error}
            </p>
          ) : null}
          <Button cargando={enviando} textoCargando="Avisando…" className="h-12.5 text-15">
            Avisar al administrador
          </Button>
          <button
            type="button"
            onClick={onCerrar}
            className="flex min-h-11 items-center justify-center text-center text-14 font-bold text-ga-texto-3 hover:text-ga-navy"
          >
            Cancelar
          </button>
        </form>
      )}
    </Modal>
  );
}

/** Confirmación de «Renovar los 36 meses» (mismo mecanismo de alerta que el retiro, R-06). */
function ModalRenovacion({
  abierto,
  onCerrar,
  accion,
  onEnviado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  accion: AccionAlerta;
  onEnviado: () => void;
}) {
  const idTitulo = useId();
  const [estado, despachar, enviando] = useActionState(
    async (previo: EstadoAlertaAsociado) => {
      const resultado = await accion(previo);
      if (resultado.ok) onEnviado();
      return resultado;
    },
    ESTADO_ALERTA_INICIAL,
  );

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} tituloId={idTitulo} anchoClassName="lg:max-w-[440px]">
      {estado.ok ? (
        <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-ga-aparecer">
          <span className="self-start text-12 font-extrabold uppercase text-ga-texto-3">Enviado</span>
          <span
            aria-hidden="true"
            className="flex h-13 w-13 items-center justify-center rounded-full bg-ga-verde-claro text-ga-verde"
          >
            <IconoCheck tamano={26} grosor={3} />
          </span>
          <h2 id={idTitulo} role="status" className="m-0 font-display text-18 font-extrabold text-ga-navy">
            {estado.mensaje ?? MENSAJE_ALERTA_ENVIADA}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-full border-1.5 border-ga-navy bg-white text-14 font-extrabold text-ga-navy hover:bg-ga-fondo-suave"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form action={despachar} className="flex flex-col items-center gap-3 text-center">
          <span className="self-start text-12 font-extrabold uppercase text-ga-texto-3">Confirmación</span>
          <h2 id={idTitulo} className="m-0 font-display text-17 font-extrabold text-ga-navy">
            ¿Confirmas que quieres renovar tus {MESES_EMBARGO} meses?
          </h2>
          <p className="m-0 text-14 leading-150 text-ga-texto-2">
            Le avisaremos al administrador para que lo confirme contigo.
          </p>
          {estado.error ? (
            <p role="alert" className="m-0 text-13 font-semibold text-ga-error">
              {estado.error}
            </p>
          ) : null}
          <Button cargando={enviando} textoCargando="Avisando…" className="h-12 w-full text-14">
            Sí, avisar al administrador
          </Button>
        </form>
      )}
    </Modal>
  );
}

/**
 * Contenido de la pantalla «Perfil» (/cuenta/perfil, pieza 3k, spec-requerimientos-ricardo §3):
 * identidad, línea de 8 pasos del proceso ejecutivo, conteo de 36 meses con «Retiro anticipado»
 * y «Renovar los 36 meses», crédito con conteo de 3 meses y «Mis datos» (el celular editable).
 * El `h1` «Tu perfil» lo pone la pantalla (components/pantallas/Perfil.tsx). El sorteo NO se
 * repite aquí: vive solo en Inicio. NUNCA muestra la tasa de interés.
 */
export function PerfilCuenta({
  nombre,
  cedula,
  grado,
  institucion,
  asesorNombre,
  proceso,
  camino,
  conteoCredito,
  plazoCreditoMeses,
  telefono,
  errorTelefono,
  guardandoTelefono = false,
  accionTelefono,
  mensajeTelefono,
  accionRetiro,
  accionRenovacion,
}: PerfilCuentaProps) {
  const [modal, setModal] = useState<"retiro" | "renovacion" | null>(null);
  // La alerta recién creada se refleja al instante (sin recargar); el servidor confirma al revalidar /cuenta.
  const [retiroEnviado, setRetiroEnviado] = useState(false);
  const [renovacionEnviada, setRenovacionEnviada] = useState(false);

  const retiroPendiente = proceso.retiro.pendiente || retiroEnviado;
  const renovacionPendiente = proceso.renovacion.pendiente || renovacionEnviada;

  const indiceActual = proceso.pasos.findIndex((p) => p.estado === "actual");
  const conteo = proceso.conteo;

  // Conteo del crédito: «1 de 3 meses» (mes en curso; R-07 cuenta desde la aprobación).
  const mesCredito = conteoCredito
    ? conteoCredito.vencido
      ? plazoCreditoMeses
      : Math.min(plazoCreditoMeses, Math.max(1, plazoCreditoMeses - conteoCredito.mesesRestantes))
    : 0;

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Identidad: nombre, asesor, grado, entidad (+ cédula, que era de «Mis datos»). */}
      <dl className="m-0 grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3.5">
        <Dato etiqueta="Nombre" valor={nombre} />
        <Dato etiqueta="Asesor" valor={asesorNombre ?? "Sin asesor"} />
        <Dato etiqueta="Grado" valor={grado} />
        <Dato etiqueta="Entidad" valor={institucion ?? "—"} />
        <div className={cx(CLASE_TARJETA_DATO, "col-span-2 lg:col-span-1")}>
          <dt className="text-13 text-ga-texto-3">Cédula</dt>
          {/* Es un dato propio del asociado, sin máscara en su propio perfil (igual que «Mis datos»). */}
          <dd className="m-0 break-words text-15 font-extrabold text-ga-texto lg:text-17">
            {cedula}
          </dd>
        </div>
      </dl>

      {/* Estado del proceso ejecutivo: línea de 8 pasos (solo lectura). */}
      <section
        aria-labelledby="proceso-titulo"
        className="flex flex-col gap-4 rounded-22 bg-white p-4.5 lg:gap-6 lg:rounded-28 lg:p-8"
      >
        <div className="flex flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-5">
          <h3 id="proceso-titulo" className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-24">
            Estado del proceso ejecutivo
          </h3>
          <span className="text-13 text-ga-texto-3 lg:text-14">Solo el equipo de la cooperativa lo actualiza</span>
        </div>
        <LineaProceso pasos={proceso.pasos} />
        {proceso.tieneProceso && proceso.estado !== "operando" && indiceActual >= 0 ? (
          // Antes de «Operando» (R-05): todavía no hay conteo ni botones de retiro/renovación.
          <div className="flex flex-col gap-2 rounded-14 bg-ga-fondo-suave p-3.5 motion-safe:animate-ga-aparecer">
            <span className="text-14 font-extrabold text-ga-navy">
              Vas en «{proceso.estadoTexto}» (paso {indiceActual + 1} de {proceso.pasos.length})
            </span>
            {conteo === null ? (
              <p className="m-0 text-14 leading-150 text-ga-texto-2">
                Tu conteo de {MESES_EMBARGO} meses empieza cuando tu proceso esté <b>operando</b>.
              </p>
            ) : null}
          </div>
        ) : null}
        {!proceso.tieneProceso ? (
          <p className="m-0 rounded-14 bg-ga-fondo-suave p-3.5 text-14 leading-150 text-ga-texto-2">
            {TEXTO_SIN_PROCESO}. {TEXTO_ANTES_DE_OPERANDO}.
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Tu camino a la estabilidad: conteo de 36 meses + retiro anticipado + renovar. */}
        {conteo ? (
          <section
            aria-labelledby="camino-titulo"
            className="flex flex-col gap-3.5 rounded-22 bg-white p-4.5 lg:gap-5 lg:rounded-28 lg:p-8"
          >
            <div className="flex items-start justify-between gap-4 lg:gap-5">
              <div className="flex flex-col gap-1">
                <h3 id="camino-titulo" className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-24">
                  Tu camino a la estabilidad
                </h3>
                <span className="hidden text-15 text-ga-texto-3 lg:block">
                  Embargo solidario · {MESES_EMBARGO} meses ininterrumpidos desde tu primer descuento
                </span>
              </div>
              {camino ? (
                <div className="flex flex-none items-baseline gap-1.5">
                  <span className="font-display text-[34px] font-extrabold leading-[.9] tracking-cifra text-ga-verde lg:text-[56px]">
                    {camino.mesActual}
                  </span>
                  <span className="text-14 font-bold text-ga-texto-3 lg:text-16">
                    <span className="lg:hidden">/{camino.totalMeses}</span>
                    <span className="hidden lg:inline">de {camino.totalMeses} meses</span>
                  </span>
                </div>
              ) : null}
            </div>
            {camino ? (
              <div
                role="progressbar"
                aria-label="Meses de embargo transcurridos"
                aria-valuemin={0}
                aria-valuemax={camino.totalMeses}
                aria-valuenow={camino.mesActual}
                className="relative h-2.5 overflow-hidden rounded-full bg-ga-verde-claro lg:h-3"
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-ga-verde transition-transform duration-500 ease-spring"
                  style={{ transform: `scaleX(${Math.min(camino.mesActual / camino.totalMeses, 1)})` }}
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1 text-13 text-ga-texto-3 lg:grid lg:grid-cols-3 lg:text-14">
              <span>
                <b className="text-ga-texto">Inicio</b> · {conteo.fechaInicioTexto}
              </span>
              <span className="lg:text-center">
                {conteo.activo ? (
                  <>
                    Faltan <b className="text-ga-texto">{conteo.faltaTexto}</b>
                  </>
                ) : (
                  "Tu conteo terminó"
                )}
              </span>
              <span className="lg:text-right">
                <b className="text-ga-texto">{MESES_EMBARGO} meses</b> · {conteo.fechaFinTexto}
              </span>
            </div>

            {proceso.retiro.visible || proceso.renovacion.visible ? (
              <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:pt-2">
                {proceso.retiro.visible ? (
                  <div className="flex flex-col gap-2">
                    {retiroPendiente || !proceso.retiro.habilitado ? (
                      <button
                        type="button"
                        disabled
                        aria-describedby={retiroPendiente ? "retiro-nota" : undefined}
                        className={BOTON_DESHABILITADO}
                      >
                        Retiro anticipado
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setModal("retiro")}
                        className="flex h-12.5 items-center justify-center rounded-full border-1.5 border-ga-error px-5 text-15 font-extrabold text-ga-error-texto transition-colors duration-200 hover:bg-ga-error-fondo focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-error"
                      >
                        Retiro anticipado
                      </button>
                    )}
                    {retiroPendiente ? (
                      <span id="retiro-nota" className="text-13 leading-140 text-ga-texto-3">
                        Ya avisamos al administrador. Te contactará pronto: no se puede avisar de nuevo mientras esa
                        alerta siga pendiente.
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {proceso.renovacion.visible ? (
                  <div className="flex flex-col gap-2">
                    {proceso.renovacion.habilitado && !renovacionPendiente ? (
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setModal("renovacion")}
                        className="flex h-12.5 items-center justify-center rounded-full bg-ga-verde px-5 text-15 font-extrabold text-white transition-colors duration-200 hover:bg-ga-verde-oscuro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
                      >
                        Renovar los {MESES_EMBARGO} meses
                      </button>
                    ) : (
                      <button type="button" disabled aria-describedby="renovar-nota" className={BOTON_DESHABILITADO}>
                        Renovar los {MESES_EMBARGO} meses
                      </button>
                    )}
                    {renovacionPendiente ? (
                      <span id="renovar-nota" className="text-13 leading-140 text-ga-texto-3">
                        Ya avisamos al administrador de tu renovación. Te contactará pronto.
                      </span>
                    ) : !proceso.renovacion.habilitado ? (
                      <span id="renovar-nota" className="text-13 leading-140 text-ga-texto-3">
                        Puedes renovar cuando cumplas {MESES_HABILITA_RENOVACION} meses de conteo.
                        {proceso.renovacion.faltaTexto ? ` ${proceso.renovacion.faltaTexto}.` : ""}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="flex flex-col gap-4">
          {conteoCredito ? (
            <section
              aria-labelledby="credito-titulo"
              className="relative flex flex-col gap-2.5 overflow-hidden rounded-22 bg-ga-verde p-4.5 text-white lg:rounded-28 lg:px-6 lg:py-6"
            >
              <span aria-hidden="true" className="absolute -bottom-16 -right-10 h-44 w-48 rounded-full bg-ga-verde-oscuro" />
              <h3 id="credito-titulo" className="relative m-0 text-13 font-normal text-ga-verde-claro lg:text-15">
                Tu crédito · plazo de {plazoCreditoMeses} meses
              </h3>
              <div className="relative flex items-baseline gap-1.5">
                <span className="font-display text-[32px] font-extrabold leading-none tracking-cifra lg:text-[46px]">
                  {mesCredito}
                </span>
                <span className="text-14 font-bold lg:text-16">de {plazoCreditoMeses} meses</span>
              </div>
              <div
                role="progressbar"
                aria-label="Meses del crédito transcurridos"
                aria-valuemin={0}
                aria-valuemax={plazoCreditoMeses}
                aria-valuenow={mesCredito}
                className="relative h-2 overflow-hidden rounded-full bg-white/18"
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-ga-ambar-fondo-fuerte transition-transform duration-500 ease-spring"
                  style={{ transform: `scaleX(${Math.min(mesCredito / plazoCreditoMeses, 1)})` }}
                />
              </div>
              <span className="relative text-13 text-ga-verde-claro lg:text-14">
                {conteoCredito.vencido ? "Tu plazo terminó." : `Faltan ${conteoCredito.faltaTexto}. `}
                Cuenta desde que se te desembolsó el crédito.
              </span>
            </section>
          ) : null}

        </div>
      </div>

      {/* «Mis datos» fusionado: el celular es lo único que el asociado puede cambiar. */}
      <section
        aria-labelledby="mis-datos-titulo"
        id="mis-datos"
        className="flex scroll-mt-4 flex-col gap-4 rounded-22 bg-white p-4.5 lg:rounded-28 lg:px-8 lg:py-7"
      >
        <div className="flex flex-col gap-1">
          <h3 id="mis-datos-titulo" className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-22">
            Mis datos
          </h3>
          <p className="m-0 text-14 leading-150 text-ga-texto-3">
            Si tu nombre, cédula o grado no están bien, habla con la cooperativa.
          </p>
        </div>
        {/* Server Action: actualiza solo perfiles.telefono (la base impide cambiar nombre, cédula, grado y rol). */}
        <form action={accionTelefono} className="flex flex-col gap-3 sm:flex-row sm:items-end lg:max-w-xl" noValidate>
          <Field id="telefono" label="Celular" error={errorTelefono} className="grow">
            {(control) => (
              <Input
                {...control}
                name="telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={telefono}
              />
            )}
          </Field>
          <Button cargando={guardandoTelefono} textoCargando="Guardando…" className="sm:h-13 sm:px-7">
            Guardar
          </Button>
          {/* Solo para lectores de pantalla: confirma que se guardó (no hay diseño de éxito). */}
          <p role="status" aria-live="polite" className="sr-only">
            {mensajeTelefono}
          </p>
        </form>
        <p className="m-0 text-14 leading-150 text-ga-texto-3">
          ¿Necesitas cambiar tu correo de ingreso? Solicítalo en «
          <Link href="/ingresar/recuperar" className="font-bold text-ga-navy underline">
            ¿Ya no tienes acceso a tu correo?
          </Link>
          » al ingresar
          {WHATSAPP_URL ? (
            <>
              , o{" "}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-ga-navy underline">
            escríbenos por WhatsApp
          </a>
            </>
          ) : null}
          .
        </p>
      </section>

      {accionRetiro ? (
        <ModalRetiro
          abierto={modal === "retiro"}
          onCerrar={() => setModal(null)}
          accion={accionRetiro}
          onEnviado={() => setRetiroEnviado(true)}
        />
      ) : null}
      {accionRenovacion ? (
        <ModalRenovacion
          abierto={modal === "renovacion"}
          onCerrar={() => setModal(null)}
          accion={accionRenovacion}
          onEnviado={() => setRenovacionEnviada(true)}
        />
      ) : null}
    </div>
  );
}
