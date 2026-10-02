import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type EstadoBadge } from "@/components/ui/Badge";
import { CarneVirtual } from "@/components/ui/CarneVirtual";
import { clasesBoton } from "@/components/ui/Button";
import { AvisoCreditoBloqueado } from "@/components/ui/AvisoCreditoBloqueado";
import { ListaConvenios } from "@/components/pantallas/ListaConvenios";
import { IconoConvenios, IconoDocumento, IconoMas, IconoSalir } from "@/components/ui/Iconos";
import { BarraInferiorCuenta } from "@/components/pantallas/BarraInferiorCuenta";
import { EncabezadoCuenta, RUTA_NUEVA_SOLICITUD } from "@/components/pantallas/EncabezadoCuenta";
import { TarjetaTope } from "@/components/cuenta/TarjetaTope";
import { PasosSolicitud } from "@/components/ui/PasosSolicitud";
import { SorteoDelMes, type SorteoDelMesProps } from "@/components/sorteo/SorteoDelMes";
import type { PerfilAsociado } from "@/lib/asociado/servidor";
import type { ConteoCredito } from "@/lib/cuenta";
import type { Convenio, PasoSolicitud } from "@/lib/mock";

export type CuentaProps = {
  /** §12.10 (pieza 3q): ganador del sorteo vigente; solo grado y nombre. `null`/ausente = sin banda. */
  ganadorSorteo?: { mesTexto: string; grado: string; nombre: string } | null;
  nombre: string;
  /** Tope de crédito según el grado (`grados_credito`). */
  tope: string;
  /** Última solicitud del asociado. `null` = todavía no tiene solicitudes (estado vacío). */
  solicitud: {
    estadoTexto: string;
    monto: string;
    modalidad: string;
    plazo: string;
    pasos: PasoSolicitud[];
    /** Conteo de 3 meses del crédito aprobado (spec §3.10, R-07). */
    conteo?: ConteoCredito | null;
  } | null;
  convenios: Convenio[];
  /**
   * «Sorteo del mes» (docs/spec-fase-2.md §4): botón + modal, ver
   * components/sorteo/SorteoDelMes. `null` cuando quien ve /cuenta no es
   * asociado (S-13, revisión de seguridad 2026-09-24): admins y asesores no
   * participan en el sorteo, así que ni se muestra el acceso.
   */
  sorteo: SorteoDelMesProps | null;
  /** Datos del carné (la cédula se muestra enmascarada). */
  cedula: string;
  grado: string;
  /**
   * Institución del carné (Policía Nacional / Ejército) y «activo» del carné: sin el dato, el
   * carné no dibuja esa línea / chip.
   */
  institucion?: string;
  /** URL firmada de la foto del carné (la arma el servidor). */
  fotoCarneUrl?: string | null;
  activo?: boolean;
  /** Server Action de «Salir» / cerrar sesión (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
  /** Enlace https://wa.me/57<NÚMERO>; sin valor, «Hablar con la cooperativa» queda sin enlace. */
  whatsappUrl?: string | null;
  /**
   * Perfil del asociado: aquí solo se usa la regla de crédito (`credito`, pedido D-16/3p). El
   * resto del perfil vive en /cuenta/perfil (pieza 3k).
   */
  perfilAsociado?: PerfilAsociado | null;
  /**
   * Lugar para el botón «Ver comprobante» (components/cuenta/ComprobanteDesembolso.tsx, lo crea otro
   * agente). Solo se pinta cuando la solicitud está «Desembolsado».
   */
  accionDesembolso?: ReactNode;
};

/** «Aprobada» → verde, «Rechazada» → rojo, «En revisión» / cualquier otro → ámbar (pieza 3a, Badge). */
const ESTADO_A_BADGE: Record<string, EstadoBadge> = {
  Aprobada: "aprobada",
  Rechazada: "rechazada",
  "En revisión": "revision",
};

/** id del aviso de crédito bloqueado (pieza 3p): el mosaico apagado lo referencia con aria-describedby. */
const ID_AVISO_CREDITO = "aviso-credito-bloqueado";

/**
 * Sello del comprobante (pieza 2b y 2c: isotipo en un círculo punteado,
 * ligeramente girado). Mismo patrón que components/pantallas/AfiliacionEnviada.tsx:
 * «esto también es un trámite formal» (nota de diseño de la pieza).
 */
function SelloComprobante() {
  return (
    <span
      aria-hidden="true"
      className="absolute right-4 top-4 flex h-14.5 w-14.5 items-center justify-center rounded-full border-2 border-dashed border-ga-ambar bg-ga-ambar-fondo-suave motion-safe:animate-ga-sello motion-reduce:rotate-[-10deg] lg:right-7 lg:top-7 lg:h-22 lg:w-22"
    >
      <Image
        src="/logos/vector/green-alliance-isotipo.svg"
        alt=""
        width={44}
        height={44}
        className="h-7 w-7 lg:h-11 lg:w-11"
      />
    </span>
  );
}

/**
 * Contenido de la tarjeta «Tu solicitud» cuando el asociado aún no tiene solicitudes.
 * Pieza 3d («/cuenta · Tu solicitud vacía»): mismo ícono-círculo con «líneas de
 * documento» (IconoDocumento) y el mismo cuadro gris de ayuda que el resto de /cuenta.
 * - Celular / tableta: todo en columna y botón a lo ancho.
 * - Escritorio (lg): la tarjeta se estira a la altura de la columna derecha; el contenido
 *   se centra en vertical y el botón toma su ancho natural.
 */
function SolicitudVacia({ creditoBloqueado }: { creditoBloqueado?: string | null }) {
  return (
    <>
      <h2 className="m-0 font-display text-18 font-extrabold lg:text-24">Tu solicitud</h2>
      <div className="flex grow flex-col gap-4 motion-safe:animate-ga-aparecer lg:justify-center lg:gap-5">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-16 bg-ga-verde-tint text-ga-verde lg:h-14 lg:w-14"
          >
            <IconoDocumento grosor={1.8} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="m-0 font-display text-17 font-extrabold text-ga-navy lg:text-20">
              Todavía no tienes solicitudes de crédito
            </p>
            <p className="m-0 text-15 leading-150 text-ga-texto-2">
              Cuando pidas un crédito, aquí verás en qué va: enviada, en revisión, aprobada y
              desembolso.
            </p>
          </div>
        </div>
        {/* → /cuenta/solicitar (formulario de solicitud de crédito). D-16: sin botón activo si no puede pedir. */}
        {creditoBloqueado ? (
          <AvisoCreditoBloqueado id={ID_AVISO_CREDITO} mensaje={creditoBloqueado} conBoton />
        ) : (
          <Link href={RUTA_NUEVA_SOLICITUD} className={clasesBoton("primario", "gap-2 lg:self-start lg:px-9")}>
            <IconoMas tamano={22} grosor={2.2} />
            Nueva solicitud
          </Link>
        )}
        <p className="m-0 rounded-10 bg-ga-fondo-suave p-3 text-14 leading-150 text-ga-texto-2 lg:px-3.5 lg:text-15 lg:leading-normal">
          Lo que puedes pedir depende de tu grado: revisa tu tope disponible.
        </p>
      </div>
    </>
  );
}

/** Franja de accesos + tope + sorteo, columna derecha del grid superior. */
function ColumnaLateral({
  tope,
  montoUsado,
  sorteo,
  whatsappUrl,
  creditoBloqueado,
}: {
  tope: string;
  /** Monto de la última solicitud, ya formateado («$ 2.500.000»); solo para el medidor visual. */
  montoUsado?: string;
  sorteo: SorteoDelMesProps | null;
  whatsappUrl?: string | null;
  /** D-16: mensaje de por qué no puede pedir crédito (null = sí puede). */
  creditoBloqueado?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <TarjetaTope tope={tope} montoUsado={montoUsado} />

      <nav id="sorteo" aria-label="Accesos" className="grid scroll-mt-4 grid-cols-2 gap-3 lg:grid-cols-1">
        {/* → /cuenta/solicitar (formulario de solicitud de crédito). */}
        {creditoBloqueado ? (
          <span
            role="link"
            aria-disabled="true"
            aria-describedby={ID_AVISO_CREDITO}
            className="flex cursor-not-allowed flex-col gap-2.5 rounded-16 bg-ga-linea-suave p-4.5 text-15 font-bold text-ga-deshabilitado-texto lg:flex-row lg:items-center lg:gap-3 lg:p-5 lg:text-16 lg:font-extrabold"
          >
            <IconoMas grosor={1.8} />
            Nueva solicitud
          </span>
        ) : (
          <Link
            href={RUTA_NUEVA_SOLICITUD}
            className="flex flex-col gap-2.5 rounded-16 bg-white p-4.5 text-15 font-bold text-ga-texto no-underline hover:bg-ga-verde-tint lg:flex-row lg:items-center lg:gap-3 lg:p-5 lg:text-16 lg:font-extrabold"
          >
            <IconoMas grosor={1.8} className="text-ga-verde" />
            Nueva solicitud
          </Link>
        )}
        {/* TODO(pendiente-spec): confirmar si «Convenios» tendrá página propia. Hoy: sección #convenios. */}
        <a
          href="#convenios"
          className="flex flex-col gap-2.5 rounded-16 bg-white p-4.5 text-15 font-bold text-ga-texto no-underline hover:bg-ga-verde-tint lg:hidden"
        >
          <IconoConvenios grosor={1.8} className="text-ga-verde" />
          Convenios
        </a>
        {/* Sorteo mensual (docs/spec-fase-2.md §4): botón + modal en un solo
            componente autocontenido (ver components/sorteo/SorteoDelMes.tsx).
            S-13: solo se renderiza para asociados (sorteo === null para
            el resto de roles, decidido en app/cuenta/page.tsx). */}
        {sorteo ? <SorteoDelMes {...sorteo} /> : null}
      </nav>

      {/* https://wa.me/57<NÚMERO> con NEXT_PUBLIC_WHATSAPP. Sin número: sin enlace (aria-disabled). */}
      {whatsappUrl ? (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={clasesBoton("terciario", "gap-2")}
        >
          Hablar con la cooperativa
        </a>
      ) : (
        <span aria-disabled="true" className={clasesBoton("terciario", "gap-2")}>
          Hablar con la cooperativa
        </span>
      )}
    </div>
  );
}

/** Inicio del asociado (pieza 2b de docs/Green Alliance C+.dc.html + estado vacío/Mis datos de 3d). */
export function Cuenta({
  nombre,
  tope,
  solicitud,
  convenios,
  sorteo,
  cedula,
  grado,
  institucion,
  fotoCarneUrl,
  activo,
  accionSalir,
  whatsappUrl,
  perfilAsociado,
  ganadorSorteo,
  accionDesembolso,
}: CuentaProps) {
  // D-16: mensaje si NO puede pedir crédito (no operando, inactivo, sin cupo…); null = puede.
  const creditoBloqueado = perfilAsociado && !perfilAsociado.credito.puedeSolicitar ? perfilAsociado.credito.mensaje : null;
  const insigniaBadge: ReactNode = solicitud ? (
    <Badge tamano="md" estado={ESTADO_A_BADGE[solicitud.estadoTexto] ?? "revision"}>
      {solicitud.estadoTexto}
    </Badge>
  ) : null;

  // Franja ámbar junto al saludo: solo si hay sorteo y la ventana ya está
  // cerrada (dentro de la ventana el acceso de la derecha ya lo dice todo).
  // «Avisarme» del sorteo (mockup 2b) no se implementa: guardar esa
  // preferencia necesita una columna nueva (perfiles.avisar_apertura_sorteo,
  // TODO(backend: docs/auditorias/2026-09-25-backend-rediseno-c-plus.md,
  // fila «Avisarme» del sorteo); esta franja es solo informativa, con datos
  // que ya calcula vistaSorteo() (mesTexto/textoProximaApertura).
  const pillSorteo = sorteo && !sorteo.ventanaAbierta && !sorteo.demo ? sorteo : null;

  return (
    <div className="min-h-dvh bg-ga-fondo-suave pb-28 lg:pb-0">
      <EncabezadoCuenta nombre={nombre} seccion="inicio" accionSalir={accionSalir} />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-5 md:mx-auto md:max-w-2xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0 flex flex-col gap-0.5 text-ga-navy lg:block">
            <span className="text-15 font-normal text-ga-texto-3 lg:font-display lg:text-44 lg:font-extrabold lg:text-ga-navy">
              Hola,
            </span>{" "}
            <span className="font-display text-30 font-extrabold lg:text-44">{nombre}</span>
          </h1>
          {pillSorteo ? (
            <span className="hidden items-center gap-2 rounded-full bg-ga-ambar-fondo px-4 py-2.5 text-15 font-bold text-ga-ambar-texto lg:inline-flex">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ga-ambar" />
              Sorteo de {pillSorteo.mesTexto}: abre el {pillSorteo.textoProximaApertura}
            </span>
          ) : null}
          {/* Nota de fidelidad: el mockup de 2b pone aquí el isotipo (decorativo, sin
              acción) en vez de «Cerrar sesión»; se mantiene «Cerrar sesión» porque
              en celular es la única forma de salir (tests/e2e/c-cuenta.spec.ts «C3»),
              solo con el color ámbar del diseño. */}
          <form action={accionSalir} className="lg:hidden">
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-ga-ambar-fondo text-ga-ambar-texto"
            >
              <IconoSalir tamano={22} grosor={1.8} />
            </button>
          </form>
        </div>

        {ganadorSorteo ? (
          <p
            role="status"
            className="m-0 flex items-center gap-2.5 rounded-20 bg-ga-ambar-fondo px-4 py-3 text-15 font-bold text-ga-ambar-texto motion-safe:animate-ga-aparecer lg:px-5 lg:text-16"
          >
            <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ga-ambar" />
            <span>
              Ganador del sorteo de {ganadorSorteo.mesTexto}: {ganadorSorteo.grado} {ganadorSorteo.nombre}
            </span>
          </p>
        ) : null}

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
          <section className="relative flex flex-col gap-4 overflow-hidden rounded-28 bg-white p-5 lg:col-span-2 lg:gap-5.5 lg:p-8">
            {solicitud ? (
              <>
                <SelloComprobante />
                <div className="flex items-center gap-3">
                  <h2 className="m-0 whitespace-nowrap font-display text-18 font-extrabold lg:text-24">
                    Tu solicitud
                  </h2>
                  {insigniaBadge}
                </div>
                <div className="flex gap-8 lg:gap-12">
                  <div className="flex flex-col gap-1">
                    <span className="text-14 text-ga-texto-3">
                      Monto solicitado
                      <span className="lg:hidden"> · modalidad {solicitud.modalidad}</span>
                    </span>
                    <span className="font-display text-44 font-extrabold leading-none tracking-cifra text-ga-navy lg:text-[72px]">
                      {solicitud.monto}
                    </span>
                  </div>
                  <div className="hidden flex-col gap-1 lg:flex">
                    <span className="text-14 text-ga-texto-3">Modalidad</span>
                    <span className="font-display text-[34px] font-extrabold text-ga-navy">
                      {solicitud.modalidad}
                    </span>
                  </div>
                  <div className="hidden flex-col gap-1 lg:flex">
                    <span className="text-14 text-ga-texto-3">Plazo</span>
                    <span className="font-display text-[34px] font-extrabold text-ga-navy">
                      {solicitud.plazo}
                    </span>
                  </div>
                </div>
                {/* «pasos animados» (pieza 2b): entrada suave, respeta prefers-reduced-motion (regla global). */}
                <div className="motion-safe:animate-ga-entrada">
                  <PasosSolicitud pasos={solicitud.pasos} variante="cuenta" />
                </div>
                <p className="m-0 rounded-10 bg-ga-fondo-suave p-3 text-14 leading-150 text-ga-texto-2 lg:px-3.5 lg:text-15 lg:leading-normal">
                  {/* La tasa se guarda en la solicitud pero NO se muestra al asociado (decisión 25-sep): es de uso interno. */}
                  Te avisaremos por correo cuando cambie el estado.
                </p>
                {/* TODO(comprobante): «Ver comprobante» del desembolso (slot `accionDesembolso`). */}
                {solicitud.estadoTexto === "Desembolsado" && accionDesembolso ? accionDesembolso : null}
                {/* Pieza 3p: con solicitud en curso (o cualquier otro motivo) el mosaico «Nueva solicitud»
                    queda apagado y el motivo se ve aquí, enlazado por aria-describedby. */}
                {creditoBloqueado ? <AvisoCreditoBloqueado id={ID_AVISO_CREDITO} mensaje={creditoBloqueado} /> : null}
              </>
            ) : (
              <SolicitudVacia creditoBloqueado={creditoBloqueado} />
            )}
          </section>

          <ColumnaLateral
            tope={tope}
            montoUsado={solicitud?.monto}
            sorteo={sorteo}
            whatsappUrl={whatsappUrl}
            creditoBloqueado={creditoBloqueado}
          />
        </div>

        {/* Carné (pieza 2b): con los datos que ya existen hoy (nombre, cédula
            enmascarada, grado); institución y «activo» quedan para cuando
            exista esa columna. */}
        <CarneVirtual
          nombre={nombre}
          cedula={cedula}
          grado={grado}
          institucion={institucion}
          activo={activo}
          fotoUrl={fotoCarneUrl}
        />

        <section
          id="convenios"
          className="flex scroll-mt-4 flex-col gap-4 rounded-28 bg-white p-5 lg:px-8 lg:py-7"
        >
          <h2 className="m-0 font-display text-18 font-extrabold lg:text-22">Tus convenios</h2>
          {/* Detalle por marca (pieza 3n): modal en escritorio, hoja inferior en celular. */}
          <ListaConvenios convenios={convenios} variante="cuenta" />
        </section>

      </main>

      {/* Barra inferior (pieza 2b): Inicio, Solicitar, Sorteo, Perfil. */}
      <BarraInferiorCuenta activa="inicio" />
    </div>
  );
}
