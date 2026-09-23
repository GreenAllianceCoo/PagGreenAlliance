import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconoInfo, IconoVolver } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { ListaNumerada } from "@/components/ui/ListaNumerada";
import { OrdenPorBreakpoint } from "@/components/ui/OrdenPorBreakpoint";
import { Logo } from "@/components/ui/Logo";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import type { Grado } from "@/lib/mock";

export type CampoAfiliacion =
  | "nombre"
  | "cedula"
  | "grado_id"
  | "unidad"
  | "celular"
  | "email"
  | "mensaje"
  | "acepto_datos";

export type AfiliacionProps = {
  /** Opciones del select «Grado» (tabla `grados_credito`). */
  grados: Grado[];
  /** Errores por campo, en español (se muestran bajo cada control). */
  errores?: Partial<Record<CampoAfiliacion, string>>;
  /** Error que no es de un campo (p. ej. límite de envíos). Mismo estilo que los errores de campo. */
  errorGeneral?: string;
  cargando?: boolean;
  /** Server Action del formulario (validar → guardar → correos → /afiliacion/enviada). */
  accion?: (formData: FormData) => void;
  /** Valores iniciales de los campos (se conserva lo escrito si hubo error). */
  valores?: Partial<Record<Exclude<CampoAfiliacion, "acepto_datos">, string>> & { acepto_datos?: boolean };
};

/** Formulario «Deseo afiliarme» (design/Afiliacion-PC.dc.html + Afiliacion-Movil.dc.html). */
export function Afiliacion({
  grados,
  errores = {},
  errorGeneral,
  cargando = false,
  accion,
  valores = {},
}: AfiliacionProps) {
  return (
    <div className="min-h-dvh bg-white lg:bg-ga-fondo-suave">
      {/* Celular: la maqueta usa 52 px arriba para simular la barra de estado del teléfono;
          en el navegador se deja en 24 px (mismo margen lateral), como en /ingresar. */}
      <header className="flex items-center justify-between gap-3 border-b border-ga-linea px-6 pb-5 pt-6 lg:h-19 lg:bg-white lg:px-14 lg:py-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="dark" />
        </Link>
        <Link
          href="/ingresar"
          aria-label="Volver al ingreso"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ga-fondo-suave text-ga-navy lg:hidden"
        >
          <IconoVolver tamano={22} />
        </Link>
        <Link href="/ingresar" className="enlace hidden text-16 font-extrabold lg:inline">
          ¿Ya eres asociado? Ingresa
        </Link>
      </header>

      <main className="flex flex-col lg:flex-row lg:items-start lg:gap-12 lg:px-14 lg:py-12">
        <aside className="flex flex-col gap-4.5 px-6 pt-6 md:mx-auto md:w-full md:max-w-2xl lg:mx-0 lg:w-aside-afiliacion lg:max-w-none lg:shrink-0 lg:gap-5 lg:p-0">
          <div className="flex flex-col gap-2 lg:gap-5">
            <h1 className="m-0 text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110 lg:tracking-titulo">
              Quiero afiliarme
            </h1>
            <p className="m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
              Déjanos tus datos y el equipo de la cooperativa te contactará para completar tu
              afiliación.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-12 bg-ga-fondo-suave p-3.5 text-14 leading-150 text-ga-texto-2 lg:rounded-14 lg:bg-white lg:p-4 lg:text-15">
            <IconoInfo tamano={20} className="mt-px shrink-0 text-ga-verde lg:mt-0.5" />
            <span>
              Esto no crea tu cuenta todavía. Cuando tu afiliación quede activa, podrás ingresar
              con tu cédula.
            </span>
          </div>
          <ListaNumerada
            className="hidden lg:flex"
            items={[
              "Envías este formulario.",
              "El equipo te contacta por WhatsApp o correo.",
              "Ya activo, ingresas con tu cédula.",
            ]}
          />
        </aside>

        <form
          action={accion}
          noValidate
          className="grid grid-cols-1 gap-4.5 px-6 pb-6 pt-4.5 md:mx-auto md:w-full md:max-w-2xl lg:mx-0 lg:max-w-none lg:grow lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:rounded-20 lg:bg-white lg:p-9"
        >
          {/* Celular: nombre, cédula, grado, UNIDAD, celular, correo.
              Escritorio: nombre, cédula, grado, celular, correo, UNIDAD (fila 4, 2 columnas).
              OrdenPorBreakpoint cambia el orden del DOM (sin duplicar campos) para que el
              orden de tabulación siga al visual; `lg:row-start-4` mantiene la ubicación
              correcta antes de hidratar. */}
          <OrdenPorBreakpoint
            ordenEscritorio={["nombre", "cedula", "grado", "celular", "email", "unidad"]}
            items={[
              {
                id: "nombre",
                contenido: (
                  <Field id="af-nombre" label="Nombres y apellidos" error={errores.nombre} className="lg:col-span-2">
                    {(control) => (
                      <Input {...control} name="nombre" autoComplete="name" defaultValue={valores.nombre} />
                    )}
                  </Field>
                ),
              },
              {
                id: "cedula",
                contenido: (
                  <Field id="af-cc" label="Número de cédula" error={errores.cedula}>
                    {(control) => (
                      <Input
                        {...control}
                        name="cedula"
                        inputMode="numeric"
                        placeholder="Sin puntos ni espacios"
                        defaultValue={valores.cedula}
                      />
                    )}
                  </Field>
                ),
              },
              {
                id: "grado",
                contenido: (
                  <Field id="af-grado" label="Grado" error={errores.grado_id}>
                    {(control) => (
                      // `key`: React 19 reinicia el <form> tras cada acción y un <select> vuelve a
                      // la opción de su primer render (defaultValue no cambia después). Al cambiar
                      // el grado devuelto, el select se vuelve a montar con el valor escrito (F-01).
                      <Select
                        key={`grado-${valores.grado_id ?? ""}`}
                        {...control}
                        name="grado_id"
                        defaultValue={valores.grado_id ?? ""}
                      >
                        <option value="">Selecciona tu grado</option>
                        {grados.map((grado) => (
                          <option key={grado.id} value={grado.id}>
                            {grado.nombre}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ),
              },
              {
                id: "unidad",
                contenido: (
                  <Field
                    id="af-unidad"
                    label="Unidad o dependencia"
                    opcional
                    error={errores.unidad}
                    className="lg:col-span-2 lg:row-start-4"
                  >
                    {(control) => <Input {...control} name="unidad" defaultValue={valores.unidad} />}
                  </Field>
                ),
              },
              {
                id: "celular",
                contenido: (
                  <Field id="af-cel" label="Celular (WhatsApp)" error={errores.celular}>
                    {(control) => (
                      <Input
                        {...control}
                        name="celular"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        placeholder="3001234567"
                        defaultValue={valores.celular}
                      />
                    )}
                  </Field>
                ),
              },
              {
                id: "email",
                contenido: (
                  <Field
                    id="af-email"
                    label="Correo electrónico"
                    error={errores.email}
                    ayuda="Aquí te llegará la confirmación y, después, tus códigos de ingreso."
                    ayudaClassName="lg:hidden"
                  >
                    {(control) => (
                      <Input
                        {...control}
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="nombre@correo.com"
                        defaultValue={valores.email}
                      />
                    )}
                  </Field>
                ),
              },
            ]}
          />
          <Field
            id="af-msg"
            label="¿Algo que debamos saber?"
            opcional
            error={errores.mensaje}
            className="lg:col-span-2"
          >
            {(control) => (
              <Textarea {...control} name="mensaje" rows={3} defaultValue={valores.mensaje} />
            )}
          </Field>
          <Checkbox
            id="af-datos"
            name="acepto_datos"
            defaultChecked={valores.acepto_datos}
            error={errores.acepto_datos}
            className="text-14 lg:col-span-2 lg:text-15"
          >
            Autorizo a la Cooperativa Green Alliance a tratar mis datos personales para gestionar
            mi afiliación, según su{" "}
            {/* Abre en otra pestaña para no perder lo escrito en el formulario.
                TODO(pendiente-spec): /politica-de-datos es un placeholder hasta tener el texto. */}
            <a href="/politica-de-datos" target="_blank" rel="noopener" className="enlace font-bold">
              política de datos
            </a>{" "}
            (Ley 1581 de 2012).
          </Checkbox>

          {/* Campo trampa (honeypot): fuera de pantalla, sin foco ni lector de pantalla.
              Si viene lleno, la Server Action responde «éxito» sin guardar. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="af-sitio">No llenar este campo</label>
            <input id="af-sitio" name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {errorGeneral ? (
            <p role="alert" className="m-0 text-14 font-semibold text-ga-error lg:col-span-2">
              {errorGeneral}
            </p>
          ) : null}

          <div className="flex flex-col gap-4.5 lg:col-span-2 lg:flex-row-reverse lg:items-center lg:justify-between lg:gap-6 lg:pt-1">
            <Button cargando={cargando} textoCargando="Enviando…" className="lg:inline-flex lg:px-9">
              Enviar solicitud
            </Button>
            <span className="text-center text-13 text-ga-texto-3 lg:text-left lg:text-14">
              Te enviaremos una copia de tu solicitud a tu correo.
            </span>
          </div>
        </form>
      </main>
    </div>
  );
}
