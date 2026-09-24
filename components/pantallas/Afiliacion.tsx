import Link from "next/link";
import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { IconoInfo, IconoVolver } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { ListaNumerada } from "@/components/ui/ListaNumerada";
import { Logo } from "@/components/ui/Logo";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { CampoFoto } from "@/components/pantallas/afiliacion/CampoFoto";
import type { Asesor } from "@/lib/afiliacion/asesores";
import type { Grado } from "@/lib/mock";
import {
  INSTITUCIONES,
  NOMBRE_INSTITUCION,
  dominioEsperado,
  type CampoAfiliacion,
  type ValoresAfiliacion,
} from "@/lib/validaciones/afiliacion";

export type { CampoAfiliacion };

export type AfiliacionProps = {
  /** Opciones del select «Grado» (tabla `grados_credito`). */
  grados: Grado[];
  /** Opciones del select «Asesor» (public.obtener_asesores_publico()). */
  asesores: Asesor[];
  /** Errores por campo, en español (se muestran bajo cada control). */
  errores?: Partial<Record<CampoAfiliacion, string>>;
  /** Error que no es de un campo (p. ej. límite de envíos). Mismo estilo que los errores de campo. */
  errorGeneral?: string;
  cargando?: boolean;
  /** Server Action del formulario (validar → subir fotos → guardar → /afiliacion/enviada). */
  accion?: (formData: FormData) => void;
  /** Valores iniciales de los campos de texto (se conserva lo escrito si hubo error; las fotos no se recuerdan). */
  valores?: Partial<ValoresAfiliacion>;
};

/** Quita del campo cualquier carácter que no sea letra, tilde, ñ o espacio (nombres/apellidos). */
function alEscribirSoloLetras(evento: ChangeEvent<HTMLInputElement>) {
  evento.target.value = evento.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, "");
}

/** Quita del campo cualquier carácter que no sea un dígito (cédula, celular, Nequi). */
function alEscribirSoloDigitos(evento: ChangeEvent<HTMLInputElement>) {
  evento.target.value = evento.target.value.replace(/[^0-9]/g, "");
}

/** Formulario «Deseo afiliarme» (design/Afiliacion-PC.dc.html + Afiliacion-Movil.dc.html, ajustado en Fase 2). */
export function Afiliacion({
  grados,
  asesores,
  errores = {},
  errorGeneral,
  cargando = false,
  accion,
  valores = {},
}: AfiliacionProps) {
  const institucionElegida = valores.institucion ?? "";

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

        {/* F-01: a 1024–1279 px el formulario queda en 1 columna (2 columnas solo desde
            1280 px / xl) para que ningún campo quede angosto (hallazgo #7 de
            docs/verificaciones/responsive-2026-09-23/reporte.md); Nequi e Institución se
            emparejan en su propia fila desde 1024 px de todos modos (ver más abajo). */}
        <form
          action={accion}
          noValidate
          className="grid grid-cols-1 gap-4.5 px-6 pb-6 pt-4.5 md:mx-auto md:w-full md:max-w-2xl lg:mx-0 lg:max-w-none lg:grow lg:rounded-20 lg:bg-white lg:p-9 xl:grid-cols-2 xl:gap-x-6 xl:gap-y-5"
        >
          <Field id="af-nombres" label="Nombres" error={errores.nombres}>
            {(control) => (
              <Input
                {...control}
                name="nombres"
                autoComplete="given-name"
                onChange={alEscribirSoloLetras}
                defaultValue={valores.nombres}
              />
            )}
          </Field>
          <Field id="af-apellidos" label="Apellidos" error={errores.apellidos}>
            {(control) => (
              <Input
                {...control}
                name="apellidos"
                autoComplete="family-name"
                onChange={alEscribirSoloLetras}
                defaultValue={valores.apellidos}
              />
            )}
          </Field>

          <Field id="af-cc" label="Número de cédula" error={errores.cedula}>
            {(control) => (
              <Input
                {...control}
                name="cedula"
                inputMode="numeric"
                placeholder="Sin puntos ni espacios"
                onChange={alEscribirSoloDigitos}
                defaultValue={valores.cedula}
              />
            )}
          </Field>
          <Field id="af-grado" label="Grado" error={errores.grado_id}>
            {(control) => (
              // `key`: React 19 reinicia el <form> tras cada acción y un <select> vuelve a
              // la opción de su primer render (defaultValue no cambia después). Al cambiar
              // el grado devuelto, el select se vuelve a montar con el valor escrito (F-01).
              <Select key={`grado-${valores.grado_id ?? ""}`} {...control} name="grado_id" defaultValue={valores.grado_id ?? ""}>
                <option value="">Selecciona tu grado</option>
                {grados.map((grado) => (
                  <option key={grado.id} value={grado.id}>
                    {grado.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* Nequi + Institución: misma fila desde 1024 px, una debajo de la otra en celular
              (pedido de la cooperativa), con su propia sub-grilla independiente de la del
              formulario (que solo pasa a 2 columnas desde 1280 px). */}
          <div className="grid grid-cols-1 gap-4.5 lg:grid-cols-2 lg:gap-4 xl:col-span-2">
            <Field id="af-nequi" label="Número Nequi" error={errores.nequi}>
              {(control) => (
                <Input
                  {...control}
                  name="nequi"
                  type="tel"
                  inputMode="numeric"
                  placeholder="3001234567"
                  onChange={alEscribirSoloDigitos}
                  defaultValue={valores.nequi}
                />
              )}
            </Field>
            <Field id="af-institucion" label="Institución" error={errores.institucion}>
              {(control) => (
                <Select
                  key={`institucion-${valores.institucion ?? ""}`}
                  {...control}
                  name="institucion"
                  defaultValue={valores.institucion ?? ""}
                >
                  <option value="">Selecciona tu institución</option>
                  {INSTITUCIONES.map((codigo) => (
                    <option key={codigo} value={codigo}>
                      {NOMBRE_INSTITUCION[codigo]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <Field id="af-cel" label="Celular" error={errores.celular}>
            {(control) => (
              <Input
                {...control}
                name="celular"
                type="tel"
                autoComplete="tel"
                inputMode="numeric"
                placeholder="3001234567"
                onChange={alEscribirSoloDigitos}
                defaultValue={valores.celular}
              />
            )}
          </Field>
          <Field
            id="af-email"
            label="Correo institucional"
            error={errores.email}
            ayuda={dominioEsperado(institucionElegida)}
          >
            {(control) => (
              <Input
                {...control}
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@policia.gov.co"
                defaultValue={valores.email}
              />
            )}
          </Field>

          <Field
            id="af-asesor"
            label="Asesor"
            opcional
            error={errores.asesor_id}
            className="xl:col-span-2"
          >
            {(control) => (
              <Select key={`asesor-${valores.asesor_id ?? ""}`} {...control} name="asesor_id" defaultValue={valores.asesor_id ?? ""}>
                <option value="">No tengo asesor</option>
                {asesores.map((asesor) => (
                  <option key={asesor.id} value={asesor.id}>
                    {asesor.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-col gap-4.5 xl:col-span-2">
            <p className="m-0 text-15 font-bold text-ga-navy">Fotos de tu documento</p>
            <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-3">
              <CampoFoto
                id="af-foto-frente"
                name="foto_cedula_frente"
                label="Cédula (frente)"
                capture="environment"
                error={errores.foto_cedula_frente}
              />
              <CampoFoto
                id="af-foto-reverso"
                name="foto_cedula_reverso"
                label="Cédula (reverso)"
                capture="environment"
                error={errores.foto_cedula_reverso}
              />
              <CampoFoto
                id="af-foto-selfie"
                name="foto_selfie"
                label="Selfie"
                capture="user"
                error={errores.foto_selfie}
              />
            </div>
          </div>

          <Field
            id="af-msg"
            label="¿Algo que debamos saber?"
            opcional
            error={errores.mensaje}
            className="xl:col-span-2"
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
            className="text-14 xl:col-span-2 xl:text-15"
          >
            Autorizo a la Cooperativa Green Alliance a tratar mis datos personales, incluida la foto
            de mi cédula (frente y reverso) y mi selfie como dato sensible, para gestionar mi
            afiliación, según su{" "}
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
            <p role="alert" className="m-0 text-14 font-semibold text-ga-error xl:col-span-2">
              {errorGeneral}
            </p>
          ) : null}

          <div className="flex flex-col gap-4.5 xl:col-span-2 xl:flex-row-reverse xl:items-center xl:justify-between xl:gap-6 xl:pt-1">
            <Button cargando={cargando} textoCargando="Enviando…" className="whitespace-nowrap xl:inline-flex xl:px-9">
              Enviar solicitud
            </Button>
            <span className="text-center text-13 text-ga-texto-3 xl:text-left xl:text-14">
              El equipo te contactará por WhatsApp o a tu correo institucional.
            </span>
          </div>
        </form>
      </main>
    </div>
  );
}
