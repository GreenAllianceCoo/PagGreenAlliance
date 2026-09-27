import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, type EstadoBadge } from "@/components/ui/Badge";
import { Button, clasesBoton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ConvenioCard } from "@/components/ui/ConvenioCard";
import { IconoConvenios, IconoDocumento, IconoMas, IconoSalir } from "@/components/ui/Iconos";
import { EncabezadoCuenta, RUTA_NUEVA_SOLICITUD } from "@/components/pantallas/EncabezadoCuenta";
import { PasosSolicitud } from "@/components/ui/PasosSolicitud";
import { SorteoDelMes, type SorteoDelMesProps } from "@/components/sorteo/SorteoDelMes";
import { enmascararCedula } from "@/lib/mascara";
import type { Convenio, PasoSolicitud } from "@/lib/mock";

export type CuentaProps = {
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
  } | null;
  convenios: Convenio[];
  /**
   * «Sorteo del mes» (docs/spec-fase-2.md §4): botón + modal, ver
   * components/sorteo/SorteoDelMes. `null` cuando quien ve /cuenta no es
   * asociado (S-13, revisión de seguridad 2026-09-24): admins y asesores no
   * participan en el sorteo, así que ni se muestra el acceso.
   */
  sorteo: SorteoDelMesProps | null;
  /** Datos de solo lectura de «Mis datos» (y del carné). */
  cedula: string;
  grado: string;
  /**
   * Institución del carné (Policía Nacional / Ejército). `perfiles` todavía
   * no tiene esta columna (propuesta en
   * supabase/migrations/20260925200100_perfiles_institucion_y_activo.sql,
   * sin aplicar): mientras tanto esta prop nunca se pasa desde
   * app/cuenta/page.tsx y el carné simplemente no muestra esa línea.
   * TODO(backend: docs/auditorias/2026-09-25-backend-rediseno-c-plus.md, fila «Carné de asociado»).
   */
  institucion?: string;
  /**
   * «Asociado/a activo/a» del carné. Misma migración pendiente que `institucion`
   * (columna `perfiles.activo`); sin ella el carné no muestra el chip de estado.
   * TODO(backend: docs/auditorias/2026-09-25-backend-rediseno-c-plus.md, fila «Carné de asociado»).
   */
  activo?: boolean;
  /**
   * «Tu camino a la estabilidad» (embargo solidario a 36 meses, pieza 2b): no
   * hay ninguna columna con la fecha del primer descuento (pregunta abierta
   * en la auditoría: ¿es un dato por asociado o por crédito? ¿arranca en la
   * aprobación o en el primer descuento real?). Mientras la cooperativa no
   * responda, esta prop no se pasa desde app/cuenta/page.tsx y la tarjeta no
   * se dibuja: no hay que inventar una fecha.
   * TODO(backend: docs/auditorias/2026-09-25-backend-rediseno-c-plus.md, fila
   * «Tu camino a la estabilidad»; pregunta abierta 2, relacionada con P-47).
   */
  caminoEstabilidad?: {
    /** Mes en curso del embargo solidario (1-based). */
    mesActual: number;
    totalMeses: number;
    /** «jun 2026» */
    fechaInicio: string;
    /** «jun 2029» */
    fechaFin: string;
  };
  /** Celular actual (único dato que el asociado puede cambiar). */
  telefono: string;
  /** Error bajo el campo de celular. */
  errorTelefono?: string;
  /** Estado de carga del botón «Guardar» de «Mis datos». */
  guardandoTelefono?: boolean;
  /** Server Action de «Guardar» en «Mis datos» (solo perfiles.telefono). */
  accionTelefono?: (formData: FormData) => void;
  /** Mensaje para lectores de pantalla tras guardar el celular. */
  mensajeTelefono?: string;
  /** Server Action de «Salir» / cerrar sesión (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
  /** Enlace https://wa.me/57<NÚMERO>; sin valor, «Hablar con la cooperativa» queda sin enlace. */
  whatsappUrl?: string | null;
};

/** «Aprobada» → verde, «Rechazada» → rojo, «En revisión» / cualquier otro → ámbar (pieza 3a, Badge). */
const ESTADO_A_BADGE: Record<string, EstadoBadge> = {
  Aprobada: "aprobada",
  Rechazada: "rechazada",
  "En revisión": "revision",
};

/** «$ 2.500.000» → 2500000 (solo para el medidor visual; no es un nuevo cálculo de tope). */
function numeroDesdeTexto(texto: string) {
  const limpio = texto.replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : 0;
}

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
function SolicitudVacia() {
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
        {/* → /cuenta/solicitar (formulario de solicitud de crédito). */}
        <Link href={RUTA_NUEVA_SOLICITUD} className={clasesBoton("primario", "gap-2 lg:self-start lg:px-9")}>
          <IconoMas tamano={22} grosor={2.2} />
          Nueva solicitud
        </Link>
        <p className="m-0 rounded-10 bg-ga-fondo-suave p-3 text-14 leading-150 text-ga-texto-2 lg:px-3.5 lg:text-15 lg:leading-normal">
          Lo que puedes pedir depende de tu grado: revisa tu tope disponible.
        </p>
      </div>
    </>
  );
}

type MisDatosProps = {
  nombre: string;
  cedula: string;
  grado: string;
  telefono: string;
  /** Error bajo el campo de celular (validación del formato). */
  errorTelefono?: string;
  /** Estado de carga del botón «Guardar». */
  guardando?: boolean;
  accion?: (formData: FormData) => void;
  /** Mensaje para lectores de pantalla (p. ej. «Guardamos tu celular»). */
  mensaje?: string;
};

/**
 * Tarjeta «Mis datos» (pieza 3d). Nombre, cédula y grado son de solo lectura
 * (la base los protege); el celular es el único campo editable. La cédula se
 * muestra completa y sin formato, tal como la guarda `perfiles.cedula` — a
 * diferencia del carné (que la enmascara), aquí es un dato propio del
 * asociado, no algo para enseñar en público.
 * - Celular: todo en una columna; botón a lo ancho.
 * - ≥ 640 px: los 3 datos en fila y el campo con «Guardar» al lado.
 * - Escritorio (lg): datos (3/5) y teléfono (2/5) en la misma fila.
 */
function MisDatos({
  nombre,
  cedula,
  grado,
  telefono,
  errorTelefono,
  guardando = false,
  accion,
  mensaje,
}: MisDatosProps) {
  const datosFijos = [
    { etiqueta: "Nombre", valor: nombre },
    { etiqueta: "Cédula", valor: cedula },
    { etiqueta: "Grado", valor: grado },
  ];

  return (
    <section
      id="mis-datos"
      aria-labelledby="mis-datos-titulo"
      className="flex scroll-mt-4 flex-col gap-4 rounded-28 bg-white p-5 lg:px-8 lg:py-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="mis-datos-titulo" className="m-0 font-display text-18 font-extrabold lg:text-22">
          Mis datos
        </h2>
        <p className="m-0 text-14 leading-150 text-ga-texto-3">
          Si tu nombre, cédula o grado no están bien, habla con la cooperativa.
        </p>
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-end lg:gap-7">
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:col-span-3">
          {datosFijos.map((dato) => (
            <div key={dato.etiqueta} className="flex flex-col gap-0.5 rounded-12 bg-ga-fondo-suave p-3.5">
              <dt className="text-14 text-ga-texto-3">{dato.etiqueta}</dt>
              <dd className="m-0 break-words text-16 font-bold text-ga-texto">{dato.valor}</dd>
            </div>
          ))}
        </dl>
        {/* Server Action: actualiza solo perfiles.telefono (la base impide cambiar nombre, cédula, grado y rol). */}
        <form action={accion} className="flex flex-col gap-3 sm:flex-row sm:items-end lg:col-span-2" noValidate>
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
          {/* sm:h-13 = misma altura que el campo (52 px) cuando van en la misma fila. */}
          <Button cargando={guardando} textoCargando="Guardando…" className="sm:h-13 sm:px-7">
            Guardar
          </Button>
          {/* Solo para lectores de pantalla: confirma que se guardó (no hay diseño de éxito). */}
          <p role="status" aria-live="polite" className="sr-only">
            {mensaje}
          </p>
        </form>
      </div>
    </section>
  );
}

/**
 * Carné de asociado (pieza 2b): tarjeta navy oscura con el isotipo, nombre,
 * cédula enmascarada y grado — los únicos datos que ya existen en `perfiles`.
 * `institucion` y `activo` son opcionales a propósito: la base todavía no los
 * tiene (ver CuentaProps), así que sin esos datos esta tarjeta simplemente no
 * los dibuja en vez de inventarlos.
 */
function CarneAsociado({
  nombre,
  cedula,
  grado,
  institucion,
  activo,
}: {
  nombre: string;
  cedula: string;
  grado: string;
  institucion?: string;
  activo?: boolean;
}) {
  return (
    <section
      aria-label="Carné de asociado"
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-28 bg-ga-verde-oscuro p-5.5 text-white lg:p-7"
    >
      {/* Mancha decorativa (mismo patrón que --ga-blob-* de la landing, pero
          en un tono propio del carné): círculo simple, sin el radio elíptico
          por esquina del mockup (sintaxis arbitraria de Tailwind poco fiable
          con «/» dentro de `rounded-[...]`). */}
      <span aria-hidden="true" className="absolute -right-12 -top-14 h-44 w-44 rounded-full bg-ga-verde" />
      <div className="relative flex items-center justify-between gap-3">
        <Image
          src="/logos/blanco/green-alliance-isotipo-blanco.svg"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 lg:h-10 lg:w-10"
        />
        {/* activo === undefined: sin el dato todavía (columna pendiente), no se muestra el chip. */}
        {activo !== undefined ? (
          <span className="rounded-full bg-ga-menta px-2.5 py-1 text-13 font-extrabold text-ga-navy-chip-oscuro">
            {activo ? "Asociado activo" : "Asociado inactivo"}
          </span>
        ) : null}
      </div>
      <span className="relative text-13 font-bold uppercase tracking-etiqueta text-ga-menta-suave">
        Carné de asociado
      </span>
      <strong className="relative font-display text-20 font-extrabold lg:text-24">{nombre}</strong>
      <span className="relative text-14 text-ga-verde-claro" style={{ fontVariantNumeric: "tabular-nums" }}>
        C.C. {enmascararCedula(cedula)} · {grado}
        {institucion ? ` · ${institucion}` : ""}
      </span>
      <span className="relative text-14 text-ga-menta-suave">Muéstralo en cada empresa en convenio.</span>
    </section>
  );
}

/**
 * «Tu camino a la estabilidad» (embargo solidario a 36 meses, pieza 2b).
 * Nunca se renderiza hoy: `caminoEstabilidad` no llega desde app/cuenta/page.tsx
 * (ver el TODO(backend) en CuentaProps). Queda lista para cuando la
 * cooperativa resuelva de dónde sale la fecha del primer descuento.
 */
function CaminoEstabilidad({
  mesActual,
  totalMeses,
  fechaInicio,
  fechaFin,
}: NonNullable<CuentaProps["caminoEstabilidad"]>) {
  const fraccion = Math.min(Math.max(mesActual / totalMeses, 0), 1);
  return (
    <section className="flex flex-col gap-4 rounded-28 bg-white p-5 lg:p-7">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display text-18 font-extrabold text-ga-navy lg:text-22">
            Tu camino a la estabilidad
          </h2>
          <span className="text-14 text-ga-texto-3">
            Embargo solidario · cuenta desde tu primer descuento en el desprendible
          </span>
        </div>
        <div className="flex flex-none items-baseline gap-1.5">
          <span className="font-display text-40 font-extrabold leading-none tracking-cifra text-ga-verde lg:text-[56px]">
            {mesActual}
          </span>
          <span className="text-15 font-bold text-ga-texto-3">de {totalMeses} meses</span>
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-ga-verde-claro">
        <div
          className="h-full origin-left rounded-full bg-ga-verde transition-transform duration-500 ease-spring"
          style={{ width: "100%", transform: `scaleX(${fraccion})` }}
        />
      </div>
      <div className="grid grid-cols-3 text-14 text-ga-texto-3">
        <span>
          <b className="text-ga-texto">Inicio</b> · {fechaInicio}
        </span>
        <span className="text-center">
          <b className="text-ga-texto">Mitad</b> · mes {Math.round(totalMeses / 2)}
        </span>
        <span className="text-right">
          <b className="text-ga-texto">De vuelta a los bancos</b> · {fechaFin}
        </span>
      </div>
    </section>
  );
}

const CLASE_TAB_INFERIOR_ACTIVA = "bg-ga-verde-claro text-ga-verde-oscuro";
const CLASE_TAB_INFERIOR_INACTIVA = "text-ga-texto-3";

/**
 * Barra inferior del asociado, solo en celular (pieza 2b). El mockup deja
 * «Nueva solicitud» únicamente aquí («Solicitar») y en el menú de escritorio,
 * sin repetirla en el cuerpo; en este código SÍ sigue repetida en el acceso
 * rápido de `nav[aria-label="Accesos"]` porque `tests/e2e/a-navegacion.spec.ts`
 * («Logo, «Inicio», «Nueva solicitud», «Convenios» y tarjetas href=#») hace
 * clic en ese enlace también en celular — quitarlo rompería la prueba.
 * Nav con nombre propio («Navegación del asociado», distinto de «Principal» y
 * «Accesos») para no chocar con los locators de esos otros nav. «Sorteo» y
 * «Mis datos» son anclas a las secciones de esta misma página (no hay rutas
 * propias todavía).
 */
function BarraInferiorCuenta() {
  return (
    <nav
      aria-label="Navegación del asociado"
      className="fixed inset-x-4 bottom-4 z-30 grid grid-cols-4 gap-1 rounded-full bg-white p-1.5 shadow-comprobante-movil lg:hidden"
    >
      <Link href="/cuenta" className={`flex h-13 flex-col items-center justify-center rounded-full text-13 font-extrabold no-underline ${CLASE_TAB_INFERIOR_ACTIVA}`}>
        Inicio
      </Link>
      <Link
        href={RUTA_NUEVA_SOLICITUD}
        className={`flex h-13 flex-col items-center justify-center rounded-full text-13 font-bold no-underline ${CLASE_TAB_INFERIOR_INACTIVA}`}
      >
        Solicitar
      </Link>
      <a href="#sorteo" className={`flex h-13 flex-col items-center justify-center rounded-full text-13 font-bold no-underline ${CLASE_TAB_INFERIOR_INACTIVA}`}>
        Sorteo
      </a>
      <a href="#mis-datos" className={`flex h-13 flex-col items-center justify-center rounded-full text-13 font-bold no-underline ${CLASE_TAB_INFERIOR_INACTIVA}`}>
        Mis datos
      </a>
    </nav>
  );
}

/** Franja de accesos + tope + sorteo, columna derecha del grid superior. */
function ColumnaLateral({
  tope,
  montoUsado,
  sorteo,
  whatsappUrl,
}: {
  tope: string;
  /** Monto de la última solicitud, ya formateado («$ 2.500.000»); solo para el medidor visual. */
  montoUsado?: string;
  sorteo: SorteoDelMesProps | null;
  whatsappUrl?: string | null;
}) {
  const toperNumero = numeroDesdeTexto(tope);
  const usadoNumero = montoUsado ? numeroDesdeTexto(montoUsado) : 0;
  const fraccion = toperNumero > 0 ? Math.min(usadoNumero / toperNumero, 1) : 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="relative flex flex-col gap-1.5 overflow-hidden rounded-28 bg-ga-verde p-5 text-white lg:gap-3 lg:p-6">
        <span aria-hidden="true" className="absolute -right-10 -bottom-16 h-44 w-44 rounded-full bg-ga-verde-oscuro" />
        <span className="relative text-14 text-ga-verde-claro lg:text-15">Tope disponible para tu grado</span>
        <span className="relative font-display text-26 font-extrabold leading-none tracking-cifra text-white lg:text-[46px]">
          {tope}
        </span>
        {/* Medidor: solo cuando ya hay una solicitud que compare contra el tope. */}
        {montoUsado ? (
          <>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-white/18 lg:h-2.5">
              <div
                className="h-full origin-left rounded-full bg-ga-ambar-fondo-fuerte transition-transform duration-500 ease-spring"
                style={{ width: "100%", transform: `scaleX(${fraccion})` }}
              />
            </div>
            <span className="relative text-13 text-ga-verde-claro lg:text-14">Tu solicitud usa {montoUsado}</span>
          </>
        ) : null}
      </section>

      <nav id="sorteo" aria-label="Accesos" className="grid scroll-mt-4 grid-cols-2 gap-3 lg:grid-cols-1">
        {/* → /cuenta/solicitar (formulario de solicitud de crédito). */}
        <Link
          href={RUTA_NUEVA_SOLICITUD}
          className="flex flex-col gap-2.5 rounded-16 bg-white p-4.5 text-15 font-bold text-ga-texto no-underline hover:bg-ga-verde-tint lg:flex-row lg:items-center lg:gap-3 lg:p-5 lg:text-16 lg:font-extrabold"
        >
          <IconoMas grosor={1.8} className="text-ga-verde" />
          Nueva solicitud
        </Link>
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

      {/* https://wa.me/57<NÚMERO> con NEXT_PUBLIC_WHATSAPP. Sin número: sin enlace (aria-disabled).
          TODO(pendiente-spec): falta el número real. */}
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
  activo,
  caminoEstabilidad,
  telefono,
  errorTelefono,
  guardandoTelefono,
  accionTelefono,
  mensajeTelefono,
  accionSalir,
  whatsappUrl,
}: CuentaProps) {
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
              </>
            ) : (
              <SolicitudVacia />
            )}
          </section>

          <ColumnaLateral
            tope={tope}
            montoUsado={solicitud?.monto}
            sorteo={sorteo}
            whatsappUrl={whatsappUrl}
          />
        </div>

        {/* «Tu camino a la estabilidad»: no se dibuja hasta que exista la fecha del
            primer descuento (ver TODO(backend) en CuentaProps). */}
        {caminoEstabilidad ? <CaminoEstabilidad {...caminoEstabilidad} /> : null}

        {/* Carné (pieza 2b): con los datos que ya existen hoy (nombre, cédula
            enmascarada, grado); institución y «activo» quedan para cuando
            exista esa columna. */}
        <CarneAsociado nombre={nombre} cedula={cedula} grado={grado} institucion={institucion} activo={activo} />

        <section
          id="convenios"
          className="flex scroll-mt-4 flex-col gap-4 rounded-28 bg-white p-5 lg:px-8 lg:py-7"
        >
          <h2 className="m-0 font-display text-18 font-extrabold lg:text-22">Tus convenios</h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5">
            {convenios.map((convenio) => (
              // TODO(pendiente-spec): no hay página de detalle del convenio.
              <ConvenioCard key={convenio.nombre} convenio={convenio} variante="enlace" href="#" />
            ))}
          </div>
        </section>

        <MisDatos
          nombre={nombre}
          cedula={cedula}
          grado={grado}
          telefono={telefono}
          errorTelefono={errorTelefono}
          guardando={guardandoTelefono}
          accion={accionTelefono}
          mensaje={mensajeTelefono}
        />
      </main>

      {/* Barra inferior (pieza 2b): navegación rápida por anclas de esta misma
          pantalla; ver la nota de fidelidad en BarraInferiorCuenta. */}
      <BarraInferiorCuenta />
    </div>
  );
}
