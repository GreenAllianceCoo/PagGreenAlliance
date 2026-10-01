"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { cx } from "@/components/ui/cx";
import { Field } from "@/components/ui/Field";
import { IconoInfo, IconoVolver } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { ListaNumerada } from "@/components/ui/ListaNumerada";
import { Logo } from "@/components/ui/Logo";
import { Select } from "@/components/ui/Select";
import { SelectBusqueda } from "@/components/ui/SelectBusqueda";
import { Textarea } from "@/components/ui/Textarea";
import { CampoFoto } from "@/components/pantallas/afiliacion/CampoFoto";
import { CampoSelfie } from "@/components/pantallas/afiliacion/CampoSelfie";
import type { Asesor } from "@/lib/afiliacion/asesores";
import {
  NOMBRE_TIPO_CUENTA,
  OPCIONES_ENTIDAD,
  TIPOS_CUENTA_BANCO,
  buscarEntidades,
  pasosCuentaNomina,
  type TipoCuentaBanco,
} from "@/lib/afiliacion/entidades";
import {
  gradoTrasCambiarInstitucion,
  gradosDeInstitucion,
  type GradoCatalogo,
} from "@/lib/gradosCatalogo";
import {
  INSTITUCIONES,
  NOMBRE_INSTITUCION,
  type CampoAfiliacion,
  type CodigoInstitucion,
  type ValoresAfiliacion,
} from "@/lib/validaciones/afiliacion";

export type { CampoAfiliacion };

export type AfiliacionProps = {
  /** Catálogo de grados (tabla `grados`, con la institución de cada uno). */
  grados: GradoCatalogo[];
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

/** Quita del campo cualquier carácter que no sea un dígito (cédula, celular, Nequi, número de cuenta). */
function alEscribirSoloDigitos(evento: ChangeEvent<HTMLInputElement>) {
  evento.target.value = evento.target.value.replace(/[^0-9]/g, "");
}

function esInstitucion(valor: string | undefined): valor is CodigoInstitucion {
  return (INSTITUCIONES as readonly string[]).includes(valor ?? "");
}

/** Formulario «Quiero afiliarme» (piezas 3c y 3j del rediseño C+, docs/Green Alliance C+.dc.html). */
export function Afiliacion({
  grados,
  asesores,
  errores = {},
  errorGeneral,
  cargando = false,
  accion,
  valores = {},
}: AfiliacionProps) {
  // Estado de los campos de los que dependen otros (institución → grado, entidad → tipo/número).
  const [institucion, setInstitucion] = useState<CodigoInstitucion | "">(
    esInstitucion(valores.institucion) ? valores.institucion : "",
  );
  const [grado, setGrado] = useState(valores.grado_id ?? "");
  const [entidad, setEntidad] = useState(valores.nomina_entidad ?? "");
  const [tipo, setTipo] = useState<TipoCuentaBanco | "">(
    (TIPOS_CUENTA_BANCO as readonly string[]).includes(valores.nomina_tipo ?? "")
      ? (valores.nomina_tipo as TipoCuentaBanco)
      : "",
  );
  const [avisoGrado, setAvisoGrado] = useState("");
  const [asesorId, setAsesorId] = useState(valores.asesor_id ?? "");
  const [largoMensaje, setLargoMensaje] = useState((valores.mensaje ?? "").length);

  const opcionesGrado = gradosDeInstitucion(grados, institucion);
  const pasos = pasosCuentaNomina(entidad);

  /** Si el grado elegido ya no existe en la nueva institución, el selector se limpia (spec §1). */
  function alCambiarInstitucion(nueva: CodigoInstitucion | "") {
    setInstitucion(nueva);
    const nuevoGrado = gradoTrasCambiarInstitucion(grados, nueva, grado);
    setGrado(nuevoGrado);
    // Pieza 3j: si el grado se limpió, se avisa en una línea (aria-live) en vez de hacerlo en silencio.
    const anterior = grados.find((g) => g.codigo === grado);
    setAvisoGrado(
      grado && nuevoGrado === "" && nueva && anterior
        ? `El grado se limpia porque “${anterior.nombre}” no existe en ${NOMBRE_INSTITUCION[nueva]}.`
        : "",
    );
  }

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
            <h1 className="m-0 font-display text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110 lg:tracking-titular">
              Quiero afiliarme
            </h1>
            <p className="m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
              Déjanos tus datos y el equipo de la cooperativa te contactará para completar tu
              afiliación.
            </p>
          </div>
          <div className="flex items-start gap-2.5 rounded-12 bg-ga-fondo-suave p-3.5 text-14 leading-150 text-ga-texto-2 lg:rounded-14 lg:bg-white lg:p-4 lg:text-15">
            <IconoInfo tamano={20} className="mt-px shrink-0 text-ga-verde lg:mt-0.5" />
            <span className="flex flex-col gap-1.5">
              <span>
                Esto no crea tu cuenta todavía. Cuando tu afiliación quede activa, podrás ingresar con tu cédula.
              </span>
              <span>
                El código para ingresar a tu cuenta llegará a tu <b>correo personal</b>, no al institucional.
              </span>
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
            docs/verificaciones/responsive-2026-09-23/reporte.md). */}
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

          <Field id="af-cc" label="Número de cédula" error={errores.cedula} className="xl:col-span-2">
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

          {/* Institución → Grado (pieza 3j): el grado depende de la institución. */}
          <Field id="af-institucion" label="Institución" error={errores.institucion}>
            {(control) => (
              <Select
                {...control}
                name="institucion"
                value={institucion}
                onChange={(e) => alCambiarInstitucion(esInstitucion(e.target.value) ? e.target.value : "")}
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
          <Field
            id="af-grado"
            label="Grado"
            error={errores.grado_id}
            ayuda={
              <span aria-live="polite" className="flex flex-col gap-0.5">
                {avisoGrado ? <span className="font-semibold text-ga-ambar-texto">{avisoGrado}</span> : null}
                <span>{institucion ? "Solo se ven los grados de tu institución." : "Primero elige tu institución."}</span>
              </span>
            }
          >
            {(control) => (
              // `key`: al cambiar la institución cambia la lista y el select se monta de nuevo,
              // con el fundido de opacidad de la pieza 3j.
              <Select
                key={`grado-${institucion}`}
                {...control}
                name="grado_id"
                disabled={!institucion}
                value={grado}
                onChange={(e) => setGrado(e.target.value)}
                className="motion-safe:animate-ga-aparecer"
              >
                <option value="">Selecciona tu grado</option>
                {opcionesGrado.map((g) => (
                  <option key={g.codigo} value={g.codigo}>
                    {g.nombre}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {/* Cuenta de nómina en cascada (pieza 3j): entidad → tipo → número. Billetera: sin tipo. */}
          <fieldset className="m-0 flex min-w-0 flex-col gap-3 rounded-16 border-0 bg-ga-fondo-suave p-3.5 xl:col-span-2 xl:p-4.5">
            <legend className="float-left mb-3 w-full p-0 text-15 font-extrabold text-ga-navy">
              Cuenta de nómina
            </legend>
            <div className="clear-both grid grid-cols-1 gap-3 xl:grid-cols-3">
              <Field id="af-nomina-entidad" label="Entidad bancaria" error={errores.nomina_entidad}>
                {(control) => (
                  <SelectBusqueda
                    {...control}
                    name="nomina_entidad"
                    etiquetaLista="Entidades"
                    opciones={OPCIONES_ENTIDAD.map((o) => ({
                      valor: o.valor,
                      etiqueta: o.etiqueta,
                      destacada: o.grupo === "otra",
                    }))}
                    filtrar={(texto) =>
                      buscarEntidades(texto).map((o) => ({
                        valor: o.valor,
                        etiqueta: o.etiqueta,
                        destacada: o.grupo === "otra",
                      }))
                    }
                    valor={entidad}
                    onCambio={setEntidad}
                    placeholder="Busca tu banco o billetera"
                  />
                )}
              </Field>

              {pasos.pideTipo ? (
                <div
                  role="radiogroup"
                  aria-labelledby="af-nomina-tipo-etiqueta"
                  className="motion-safe:animate-ga-aparecer flex flex-col gap-1.5"
                >
                  <span id="af-nomina-tipo-etiqueta" className="text-15 font-bold">
                    Tipo de cuenta
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS_CUENTA_BANCO.map((t) => (
                      <label
                        key={t}
                        className={cx(
                          "flex h-13 cursor-pointer items-center justify-center rounded-12 border-1.5 text-15 transition-colors duration-150",
                          "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ga-verde",
                          tipo === t
                            ? "border-ga-verde bg-ga-verde-claro font-extrabold text-ga-verde"
                            : "border-ga-borde-input bg-white font-bold text-ga-texto",
                          errores.nomina_tipo && tipo !== t && "border-ga-error",
                        )}
                      >
                        <input
                          type="radio"
                          name="nomina_tipo"
                          value={t}
                          defaultChecked={tipo === t}
                          onChange={() => setTipo(t)}
                          className="sr-only"
                        />
                        {NOMBRE_TIPO_CUENTA[t]}
                      </label>
                    ))}
                  </div>
                  {errores.nomina_tipo ? (
                    <span className="text-13 font-semibold text-ga-error">{errores.nomina_tipo}</span>
                  ) : null}
                </div>
              ) : null}

              {pasos.pideNumero ? (
                <Field
                  id="af-nomina-numero"
                  label={pasos.pideTipo ? "Número de cuenta" : "Número de esa billetera (tu celular)"}
                  error={errores.nomina_numero}
                  className="motion-safe:animate-ga-aparecer"
                >
                  {(control) => (
                    <Input
                      {...control}
                      name="nomina_numero"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={pasos.pideTipo ? "De 6 a 20 dígitos" : "3001234567"}
                      onChange={alEscribirSoloDigitos}
                      defaultValue={valores.nomina_numero}
                    />
                  )}
                </Field>
              ) : null}
            </div>

            {pasos.pideNombreOtra ? (
              <Field
                id="af-nomina-otra"
                label="Nombre de la entidad"
                error={errores.nomina_entidad_otra}
                className="motion-safe:animate-ga-aparecer"
              >
                {(control) => (
                  <Input
                    {...control}
                    name="nomina_entidad_otra"
                    placeholder="Escribe el nombre…"
                    maxLength={60}
                    defaultValue={valores.nomina_entidad_otra}
                  />
                )}
              </Field>
            ) : null}
            {entidad && !pasos.pideTipo && pasos.pideNumero ? (
              <span className="text-13 text-ga-texto-3">Con una billetera no se pregunta el tipo de cuenta.</span>
            ) : null}
          </fieldset>

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

          <Field id="af-correo-inst" label="Correo institucional" error={errores.correo_institucional}>
            {(control) => (
              <Input
                {...control}
                name="correo_institucional"
                type="email"
                autoComplete="off"
                placeholder="nombre@correo.com"
                defaultValue={valores.correo_institucional}
              />
            )}
          </Field>
          <Field id="af-email" label="Correo personal" error={errores.email} ayuda="Tu código de ingreso llega aquí.">
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

          <Field id="af-asesor" label="Asesor" opcional error={errores.asesor_id} className="xl:col-span-2">
            {(control) => (
              <Select {...control} name="asesor_id" defaultValue={asesorId} onChange={(e) => setAsesorId(e.target.value)}>
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
            <p className="m-0 text-15 font-extrabold text-ga-navy">Fotos de tu documento</p>
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
              <CampoSelfie id="af-foto-selfie" name="foto_selfie" label="Selfie" error={errores.foto_selfie} />
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
              <>
                <Textarea
                  {...control}
                  name="mensaje"
                  rows={3}
                  maxLength={500}
                  placeholder="Cuéntanos si hay algo más…"
                  defaultValue={valores.mensaje}
                  onChange={(e) => setLargoMensaje(e.target.value.length)}
                />
                <span aria-hidden="true" className="self-end text-12 text-ga-texto-3">
                  {largoMensaje}/500
                </span>
              </>
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
                /politica-de-datos: política v1.0 (VERSION_POLITICA_DATOS en lib/politica-datos.ts). */}
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
            <p role="alert" className="m-0 text-13 font-semibold text-ga-error xl:col-span-2">
              {errorGeneral}
            </p>
          ) : null}

          <div className="flex flex-col gap-4.5 xl:col-span-2 xl:flex-row-reverse xl:items-center xl:justify-between xl:gap-6 xl:pt-1">
            <Button cargando={cargando} textoCargando="Enviando…" className="whitespace-nowrap xl:inline-flex xl:px-9">
              Enviar solicitud
            </Button>
            <span className="text-center text-13 text-ga-texto-3 xl:text-left xl:text-14">
              El equipo te contactará por WhatsApp o a tu correo personal.
            </span>
          </div>
        </form>
      </main>
    </div>
  );
}
