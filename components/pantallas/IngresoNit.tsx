import Link from "next/link";
import { PanelIngreso, CLASES_FORM_INGRESO, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { ProgressSteps } from "@/components/ui/ProgressSteps";

export type IngresoNitProps = {
  whatsapp: string;
  whatsappUrl?: string | null;
  /** Error bajo el campo del NIT. */
  error?: string;
  cargando?: boolean;
  /** Server Action del formulario (buscar NIT → enviar código). */
  accion?: (formData: FormData) => void;
  /** Valor inicial del campo (se conserva lo escrito si hubo error). */
  valorNit?: string;
};

/**
 * Ingreso de la empresa en convenio · paso 1 (NIT). Mismo panel y mismo paso 2
 * que el ingreso con cédula (docs/spec-convenios.md §B2).
 */
export function IngresoNit({ whatsapp, whatsappUrl, error, cargando = false, accion, valorNit }: IngresoNitProps) {
  const numero = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
      {whatsapp}
    </a>
  ) : (
    whatsapp
  );

  return (
    <PanelIngreso
      titulo="Empresas en convenio"
      subtitulo={
        <>
          <span className="lg:hidden">Entra para publicar tus promociones.</span>
          <span className="hidden lg:inline">
            Entra con el NIT de tu empresa y un código que llega al correo de acceso. Sin contraseñas.
          </span>
        </>
      }
      pie={<>Ayuda por WhatsApp {numero}</>}
      pieInterlineado={false}
      sinBarraEstado
    >
      <form action={accion} className={CLASES_FORM_INGRESO} noValidate>
        <ProgressSteps pasoActual={1} totalPasos={2} />
        <h2 className="m-0 hidden font-display text-32 font-extrabold text-ga-navy lg:block">Ingresa con tu NIT</h2>
        <Field id="nit" label="NIT de la empresa" tamano="lg" error={error}>
          {(control) => (
            <Input
              {...control}
              name="nit"
              tamano="lg"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Ejemplo: 902.038.118-7"
              defaultValue={valorNit}
            />
          )}
        </Field>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          Si el NIT tiene acceso activo, te enviamos un código de 6 números al correo de acceso que registró
          Green Alliance.
        </p>
        <Button cargando={cargando} textoCargando="Enviando…">
          Enviarme el código
        </Button>
        <Link href="/ingresar" className="enlace self-center text-15 font-bold">
          Soy asociado, entrar con mi cédula
        </Link>
        <PieIngresoMovil interlineado={false}>Ayuda por WhatsApp {numero}</PieIngresoMovil>
      </form>
    </PanelIngreso>
  );
}
