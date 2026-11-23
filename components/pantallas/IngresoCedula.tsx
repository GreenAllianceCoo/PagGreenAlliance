import Link from "next/link";
import { PanelIngreso,CLASES_FORM_INGRESO, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconoCandado } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { ComprobanteSolicitud } from "@/components/pantallas/landing/ComprobanteSolicitud";

export type IngresoCedulaProps = {
  whatsapp: string;
  /** Enlace https://wa.me/57<NÚMERO>; sin valor se muestra el texto sin enlace. */
  whatsappUrl?: string | null;
  /** Error bajo el campo de cédula (validación de formato). */
  error?: string;
  /** Estado de carga del envío: «Enviando…». */
  cargando?: boolean;
  /** Server Action del formulario (buscar cédula → enviar código). */
  accion?: (formData: FormData) => void;
  /** Valor inicial del campo (se conserva lo escrito si hubo error). */
  valorCedula?: string;
};

/** Ingreso paso 1 · cédula (pieza 3b del rediseño C+, docs/Green Alliance C+.dc.html). */
export function IngresoCedula({
  whatsapp,
  whatsappUrl,
  error,
  cargando = false,
  accion,
  valorCedula,
}: IngresoCedulaProps) {
  // Número de WhatsApp: enlace solo si NEXT_PUBLIC_WHATSAPP existe (mapa §2).
  const numero = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
      {whatsapp}
    </a>
  ) : (
    whatsapp
  );

  return (
    <PanelIngreso
      // Fase 2: el logo ya está al lado del formulario; el panel dice qué encuentras y lo muestra.
      titulo="Tu crédito, paso a paso"
      subtitulo="Entra para ver cómo va tu solicitud."
      extraEscritorio={
        // El mismo comprobante vivo de la landing (ilustración, sin datos reales).
        <ComprobanteSolicitud variante="desktop" className="mr-7 mt-14 hidden lg:flex" />
      }
      // Número en lib/config.ts (NEXT_PUBLIC_WHATSAPP); sin él, texto sin enlace.
      pie={<>Ayuda por WhatsApp {numero}</>}
      pieInterlineado={false}
      // En el navegador no hay barra de estado del teléfono: panel sin el relleno extra.
      sinBarraEstado
    >
      <form action={accion} className={CLASES_FORM_INGRESO} noValidate>
        <ProgressSteps pasoActual={1} totalPasos={2} />
        <h2 className="m-0 hidden font-display text-32 font-semibold text-ga-navy lg:block">
          Ingresa con tu cédula
        </h2>
        <Field id="cedula" label="Número de cédula" tamano="lg" error={error}>
          {(control) => (
            <Input
              {...control}
              name="cedula"
              tamano="lg"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Sin puntos ni espacios"
              defaultValue={valorCedula}
            />
          )}
        </Field>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          Si tu cédula está registrada, te enviamos un código de 6 números al correo que tienes en
          la cooperativa.<span className="lg:hidden"> No necesitas contraseña.</span>
        </p>
        <Button cargando={cargando} textoCargando="Enviando…">
          Enviarme el código
        </Button>
        {/* Recuperación de acceso: quien perdió o cambió su correo pide ayuda a la cooperativa. */}
        <Link
          href="/ingresar/recuperar"
          className="self-center text-14 font-medium text-ga-texto-2 underline hover:text-ga-verde"
        >
          ¿Ya no tienes acceso a tu correo?
        </Link>
        {/* Fase 2: un solo botón grande; las otras entradas quedan como enlaces discretos. */}
        <div className="mt-2 flex flex-col gap-2 border-t border-ga-linea pt-5 text-14 text-ga-texto-2">
          <p className="m-0">
            ¿Aún no eres asociado?{" "}
            <Link href="/afiliacion" className="enlace font-semibold">
              Deseo afiliarme
            </Link>
          </p>
          <p className="m-0">
            ¿Eres empresa en convenio?{" "}
            <Link href="/ingresar/convenio" className="enlace font-semibold">
              Entra con tu NIT
            </Link>
          </p>
        </div>
        <p className="m-0 flex items-center gap-2 text-13 text-ga-texto-3">
          <IconoCandado tamano={16} className="shrink-0" />
          <span>
            Tus datos están protegidos por la cooperativa ·{" "}
            <Link href="/politica-de-datos" className="underline hover:text-ga-verde">
              Política de datos
            </Link>
          </span>
        </p>
        <PieIngresoMovil interlineado={false}>Ayuda por WhatsApp {numero}</PieIngresoMovil>
      </form>
    </PanelIngreso>
  );
}
