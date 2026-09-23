import { PanelIngreso, CLASES_FORM_INGRESO, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { ProgressSteps } from "@/components/ui/ProgressSteps";

export type IngresoCodigoProps = {
  /** Correo enmascarado (ju•••@correo.com) leído de la cookie del paso 1. */
  correoEnmascarado: string;
  whatsapp: string;
  /** Enlace https://wa.me/57<NÚMERO>; sin valor se muestra el texto sin enlace. */
  whatsappUrl?: string | null;
  /** Dígitos escritos (uno por casilla). */
  digitos?: string[];
  /** Cambios en las casillas del código (las vuelve interactivas). */
  onCambioCodigo?: (digitos: string[]) => void;
  /** Tiempo restante para reenviar (m:ss). Vacío = ya se puede reenviar. */
  tiempoReenvio?: string;
  /** Error genérico: «El código no es válido o ya venció». */
  error?: string;
  cargando?: boolean;
  /** Server Action de «Entrar a mi cuenta» (verifyOtp → /cuenta). */
  accion?: (formData: FormData) => void;
  /** Server Action de «Reenviar código» (formAction del botón). */
  accionReenviar?: (formData: FormData) => void;
  /** «Entrar a mi cuenta» deshabilitado (p. ej. faltan dígitos). */
  entrarDeshabilitado?: boolean;
  /** «Reenviar código» deshabilitado (contador corriendo o reenviando). */
  reenviarDeshabilitado?: boolean;
  /** Mensaje para lectores de pantalla (p. ej. «te enviamos un código nuevo»). */
  mensajeEstado?: string;
  /** Destino de «Cambiar cédula» / «Volver»: borra la cookie del paso 1. */
  cambiarHref?: string;
};

/** Ingreso paso 2 · código (design/Codigo-PC.dc.html + Codigo-Movil.dc.html). */
export function IngresoCodigo({
  correoEnmascarado,
  whatsapp,
  whatsappUrl,
  digitos = [],
  onCambioCodigo,
  tiempoReenvio,
  error,
  cargando = false,
  accion,
  accionReenviar,
  entrarDeshabilitado = false,
  reenviarDeshabilitado = false,
  mensajeEstado,
  cambiarHref = "/ingresar/cambiar",
}: IngresoCodigoProps) {
  const numero = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
      {whatsapp}
    </a>
  ) : (
    whatsapp
  );
  const textoWhatsapp = (
    // TODO(pendiente-spec): falta el número real (NEXT_PUBLIC_WHATSAPP); sin él, texto sin enlace.
    <>¿Cambiaste de correo? Escríbenos por WhatsApp {numero} para actualizarlo.</>
  );

  return (
    <PanelIngreso
      titulo="Revisa tu correo"
      subtitulo={
        <>
          <span className="lg:hidden">Lo enviamos a {correoEnmascarado}</span>
          <span className="hidden lg:inline">
            Te enviamos un código a {correoEnmascarado}. Vence en 10 minutos.
          </span>
        </>
      }
      pie={textoWhatsapp}
      // La flecha «Volver» pasa por /ingresar/cambiar, que borra la cookie del paso 1.
      volverHref={cambiarHref}
      sinBarraEstado
    >
      <form action={accion} className={CLASES_FORM_INGRESO} noValidate>
        <ProgressSteps
          pasoActual={2}
          totalPasos={2}
          accion={
            // <a> normal (sin prefetch): /ingresar/cambiar borra la cookie y vuelve a /ingresar.
            <a href={cambiarHref} className="enlace hidden text-15 font-bold lg:inline">
              Cambiar cédula
            </a>
          }
        />
        <h2 className="m-0 hidden text-32 font-extrabold text-ga-navy lg:block">
          Escribe el código
        </h2>
        <OtpInput name="codigo" valores={digitos} error={error} onCambio={onCambioCodigo} />
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          <span className="lg:hidden">El código vence en 10 minutos. </span>Si no lo ves, revisa la
          carpeta de spam.
        </p>
        <Button cargando={cargando} textoCargando="Entrando…" disabled={entrarDeshabilitado}>
          Entrar a mi cuenta
        </Button>
        <p className="m-0 text-center text-15 text-ga-texto-3">
          ¿No te llegó?{" "}
          <button
            type="submit"
            formAction={accionReenviar}
            disabled={reenviarDeshabilitado}
            className="enlace font-extrabold disabled:cursor-not-allowed"
          >
            Reenviar código
          </button>
          {tiempoReenvio ? <> en {tiempoReenvio}</> : null}
        </p>
        {/* Solo para lectores de pantalla: confirma el reenvío sin cambiar el diseño. */}
        <p role="status" aria-live="polite" className="sr-only">
          {mensajeEstado}
        </p>
        <PieIngresoMovil>{textoWhatsapp}</PieIngresoMovil>
      </form>
    </PanelIngreso>
  );
}
