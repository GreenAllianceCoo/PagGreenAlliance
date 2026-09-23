import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button, clasesBoton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ConvenioCard } from "@/components/ui/ConvenioCard";
import { IconoConvenios, IconoDocumento, IconoMas, IconoSalir } from "@/components/ui/Iconos";
import { Logo } from "@/components/ui/Logo";
import { PasosSolicitud } from "@/components/ui/PasosSolicitud";
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
    /** Tasa de interés mensual («7,9 %»). La cuota no se calcula. */
    tasa?: string;
    pasos: PasoSolicitud[];
  } | null;
  convenios: Convenio[];
  /** Datos de solo lectura de «Mis datos». */
  cedula: string;
  grado: string;
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

/** Destino de «Nueva solicitud»: el formulario existente (decisión del 23-sep). */
const RUTA_NUEVA_SOLICITUD = "/dashboard/solicitar";

/**
 * Contenido de la tarjeta «Tu solicitud» cuando el asociado aún no tiene solicitudes.
 * No hay maqueta: reutiliza el título, los tamaños de texto, el cuadro gris claro
 * (bg-ga-fondo-suave, radio 10) y el botón primario de las demás tarjetas de Inicio.
 * - Celular / tableta: todo en columna y botón a lo ancho (como los botones de Inicio-Movil).
 * - Escritorio (lg): la tarjeta se estira a la altura de la columna derecha; el contenido
 *   se centra en vertical y el botón toma su ancho natural (como en Enviada-PC).
 */
function SolicitudVacia() {
  return (
    <>
      <h2 className="m-0 text-18 font-extrabold lg:text-20">Tu solicitud</h2>
      <div className="flex grow flex-col gap-4 lg:justify-center lg:gap-5">
        <div className="flex items-start gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-14 bg-ga-verde-tint text-ga-verde lg:h-13 lg:w-13"
          >
            <IconoDocumento grosor={1.8} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="m-0 text-17 font-extrabold text-ga-navy lg:text-20">
              Todavía no tienes solicitudes de crédito
            </p>
            <p className="m-0 text-15 leading-150 text-ga-texto-2">
              Cuando pidas un crédito, aquí verás en qué va: enviada, en revisión, aprobada y
              desembolso.
            </p>
          </div>
        </div>
        {/* El mapa lo marca Pendiente; por decisión del 23-sep va al formulario existente. */}
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
 * Tarjeta «Mis datos». No existe en Inicio-Movil / Inicio-PC: usa la tarjeta blanca
 * (rounded-18, p-5 / lg:px-7 lg:py-6) y el título de «Tus convenios», los cuadros grises
 * (bg-ga-fondo-suave) de las notas de /cuenta y el Field + Input + botón primario del
 * formulario de afiliación.
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
      aria-labelledby="mis-datos-titulo"
      className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:px-7 lg:py-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="mis-datos-titulo" className="m-0 text-18 font-extrabold">
          Mis datos
        </h2>
        <p className="m-0 text-14 leading-150 text-ga-texto-3">
          Si tu nombre, cédula o grado no están bien, habla con la cooperativa.
        </p>
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-5 lg:items-end lg:gap-6">
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

/** Inicio del asociado (design/Inicio-PC.dc.html + Inicio-Movil.dc.html). */
export function Cuenta({
  nombre,
  tope,
  solicitud,
  convenios,
  cedula,
  grado,
  telefono,
  errorTelefono,
  guardandoTelefono,
  accionTelefono,
  mensajeTelefono,
  accionSalir,
  whatsappUrl,
}: CuentaProps) {
  return (
    <div className="min-h-dvh bg-ga-fondo-suave">
      {/* Celular: la maqueta deja 48 px arriba para simular la barra de estado del teléfono;
          en el navegador se usa 24 px, como en las demás pantallas. En tableta el header se
          alinea con el contenido centrado (max-w-2xl). */}
      <header className="flex items-center justify-between px-5 pt-6 md:mx-auto md:max-w-2xl lg:mx-0 lg:h-19 lg:max-w-none lg:border-b lg:border-ga-linea lg:bg-white lg:px-14 lg:pt-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo">
          <Logo tone="dark" />
        </Link>
        <nav aria-label="Principal" className="hidden gap-7 text-16 font-bold lg:flex">
          <Link
            href="/cuenta"
            aria-current="page"
            className="border-b-2 border-ga-verde pb-1 text-ga-verde no-underline"
          >
            Inicio
          </Link>
          {/* El mapa lo marca Pendiente; por decisión del 23-sep va al formulario existente. */}
          <Link href={RUTA_NUEVA_SOLICITUD} className="text-ga-texto no-underline hover:text-ga-verde">
            Nueva solicitud
          </Link>
          {/* Sección #convenios de esta página (decisión del 23-sep).
              TODO(pendiente-spec): confirmar si «Convenios» tendrá página propia. */}
          <a href="#convenios" className="text-ga-texto no-underline hover:text-ga-verde">
            Convenios
          </a>
        </nav>
        <div className="hidden items-center gap-3.5 text-15 lg:flex">
          <span className="font-bold">{nombre}</span>
          <form action={accionSalir}>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-10 border-1.5 border-ga-borde px-3.5 font-bold text-ga-navy hover:bg-ga-fondo-suave"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-col gap-4 px-5 pb-6 pt-4 md:mx-auto md:max-w-2xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <div className="flex items-center justify-between">
          <h1 className="m-0 flex flex-col gap-0.5 font-extrabold text-ga-navy lg:block lg:text-32">
            <span className="text-15 font-normal text-ga-texto-3 lg:text-32 lg:font-extrabold lg:text-ga-navy">
              Hola,
            </span>{" "}
            <span className="text-24 lg:text-32">{nombre}</span>
          </h1>
          <form action={accionSalir} className="lg:hidden">
            <button
              type="submit"
              aria-label="Cerrar sesión"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ga-navy"
            >
              <IconoSalir tamano={22} grosor={1.8} />
            </button>
          </form>
        </div>

        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
          <section className="flex flex-col gap-4 rounded-18 bg-white p-5 lg:col-span-2 lg:gap-5.5 lg:p-7">
            {solicitud ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="m-0 text-18 font-extrabold lg:text-20">Tu solicitud</h2>
                  <Badge tamano="md">{solicitud.estadoTexto}</Badge>
                </div>
                <div className="flex gap-12">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-14 text-ga-texto-3">
                      Monto solicitado
                      <span className="lg:hidden"> · modalidad {solicitud.modalidad}</span>
                    </span>
                    <span className="text-32 font-extrabold text-ga-navy lg:text-34">
                      {solicitud.monto}
                    </span>
                  </div>
                  <div className="hidden flex-col gap-0.5 lg:flex">
                    <span className="text-14 text-ga-texto-3">Modalidad</span>
                    <span className="text-34 font-extrabold text-ga-navy">{solicitud.modalidad}</span>
                  </div>
                  <div className="hidden flex-col gap-0.5 lg:flex">
                    <span className="text-14 text-ga-texto-3">Plazo</span>
                    <span className="text-34 font-extrabold text-ga-navy">{solicitud.plazo}</span>
                  </div>
                </div>
                <PasosSolicitud pasos={solicitud.pasos} variante="cuenta" />
                <p className="m-0 rounded-10 bg-ga-fondo-suave p-3 text-14 leading-150 text-ga-texto-2 lg:px-3.5 lg:text-15 lg:leading-normal">
                  {/* La tasa se guarda en la solicitud y se muestra; la cuota no se calcula. */}
                  {solicitud.tasa ? <>Interés mensual: {solicitud.tasa}. </> : null}
                  Te avisaremos por correo cuando cambie el estado.
                </p>
              </>
            ) : (
              <SolicitudVacia />
            )}
          </section>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-1.5 rounded-18 bg-ga-navy p-5 text-white lg:p-6">
              <span className="text-14 text-ga-navy-texto-suave">Tope disponible para tu grado</span>
              <span className="text-26 font-extrabold lg:text-30">{tope}</span>
            </section>
            <nav aria-label="Accesos" className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {/* El mapa lo marca Pendiente; por decisión del 23-sep va al formulario existente. */}
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
        </div>

        <section
          id="convenios"
          className="flex scroll-mt-4 flex-col gap-4 rounded-18 bg-white p-5 lg:px-7 lg:py-6"
        >
          <h2 className="m-0 text-18 font-extrabold">Tus convenios</h2>
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
    </div>
  );
}
