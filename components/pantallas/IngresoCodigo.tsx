import Link from "next/link";
import { PanelIngreso, CLASES_FORM_INGRESO, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { ProgressSteps } from "@/components/ui/ProgressSteps";

export type IngresoCodigoProps = {
  /** Correo enmascarado (ju•••@correo.com) leído de la cookie del paso 1. */
  correoEnmascarado: string;
  whatsapp: string;
  /** Dígitos ya escritos (solo para mostrar el diseño). */
  digitos?: string[];
  /** Tiempo restante para reenviar (m:ss). Vacío = ya se puede reenviar. */
  tiempoReenvio?: string;
  /** Error genérico: «El código no es válido o ya venció». */
  error?: string;
  cargando?: boolean;
};

/** Ingreso paso 2 · código (design/Codigo-PC.dc.html + Codigo-Movil.dc.html). */
export function IngresoCodigo({
  correoEnmascarado,
  whatsapp,
  digitos = [],
  tiempoReenvio,
  error,
  cargando = false,
}: IngresoCodigoProps) {
  const textoWhatsapp = (
    // TODO(pendiente-spec): enlace https://wa.me/57<NÚMERO> cuando exista NEXT_PUBLIC_WHATSAPP.
    <>¿Cambiaste de correo? Escríbenos por WhatsApp {whatsapp} para actualizarlo.</>
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
      // TODO(funcionalidad): la flecha «Volver» también debe limpiar la cookie del paso 1.
      volverHref="/ingresar"
      sinBarraEstado
    >
      {/* TODO(funcionalidad): action = Server Action con verifyOtp → /cuenta (mapa §3). */}
      <form className={CLASES_FORM_INGRESO} noValidate>
        <ProgressSteps
          pasoActual={2}
          totalPasos={2}
          accion={
            // TODO(funcionalidad): «Cambiar cédula» también debe limpiar la cookie del paso 1.
            <Link href="/ingresar" className="enlace hidden text-15 font-bold lg:inline">
              Cambiar cédula
            </Link>
          }
        />
        <h2 className="m-0 hidden text-32 font-extrabold text-ga-navy lg:block">
          Escribe el código
        </h2>
        <OtpInput name="codigo" valores={digitos} error={error} />
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          <span className="lg:hidden">El código vence en 10 minutos. </span>Si no lo ves, revisa la
          carpeta de spam.
        </p>
        {/* TODO(funcionalidad): deshabilitar hasta tener los 6 dígitos. */}
        <Button cargando={cargando} textoCargando="Entrando…">
          Entrar a mi cuenta
        </Button>
        <p className="m-0 text-center text-15 text-ga-texto-3">
          ¿No te llegó?{" "}
          {/* TODO(funcionalidad): reenviar el código (repite el paso 1) y reiniciar el contador de 45 s.
              Usar formAction propio; queda deshabilitado mientras corre el contador. */}
          <button
            type="submit"
            name="accion"
            value="reenviar"
            className="enlace font-extrabold disabled:cursor-not-allowed"
          >
            Reenviar código
          </button>
          {tiempoReenvio ? <> en {tiempoReenvio}</> : null}
        </p>
        <PieIngresoMovil>{textoWhatsapp}</PieIngresoMovil>
      </form>
    </PanelIngreso>
  );
}
