import { PanelIngreso, CLASES_FORM_INGRESO, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconoCheck } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { ProgressSteps } from "@/components/ui/ProgressSteps";

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

const BENEFICIOS = [
  "Pide tu crédito según tu grado",
  "Mira el estado de tu solicitud",
  "Usa los convenios para asociados",
];

/** Ingreso paso 1 · cédula (design/Ingreso-PC.dc.html + Ingreso-Movil.dc.html). */
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
      titulo="Hola de nuevo"
      subtitulo={
        <>
          <span className="lg:hidden">Entra para ver cómo va tu crédito.</span>
          <span className="hidden lg:inline">
            Entra con tu cédula y un código que te llega al correo. Sin contraseñas que recordar.
          </span>
        </>
      }
      extraEscritorio={
        <ul className="m-0 hidden list-none flex-col gap-3.5 p-0 text-17 lg:flex">
          {BENEFICIOS.map((texto) => (
            <li key={texto} className="flex items-center gap-3">
              <IconoCheck tamano={22} className="text-ga-verde-icono" />
              {texto}
            </li>
          ))}
        </ul>
      }
      // TODO(pendiente-spec): falta el número real (NEXT_PUBLIC_WHATSAPP); sin él, texto sin enlace.
      pie={<>Ayuda por WhatsApp {numero}</>}
      pieInterlineado={false}
      // En el navegador no hay barra de estado del teléfono: panel sin el relleno extra.
      sinBarraEstado
    >
      <form action={accion} className={CLASES_FORM_INGRESO} noValidate>
        <ProgressSteps pasoActual={1} totalPasos={2} />
        <h2 className="m-0 hidden text-32 font-extrabold text-ga-navy lg:block">
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
        <div className="flex items-center gap-3 text-14 text-ga-texto-3">
          <span className="h-px grow bg-ga-linea" />
          ¿Aún no eres asociado?
          <span className="h-px grow bg-ga-linea" />
        </div>
        <ButtonLink href="/afiliacion" variante="secundario">
          Deseo afiliarme
        </ButtonLink>
        <PieIngresoMovil interlineado={false}>Ayuda por WhatsApp {numero}</PieIngresoMovil>
      </form>
    </PanelIngreso>
  );
}
