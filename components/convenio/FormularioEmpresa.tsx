"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { guardarDatosEmpresa, type EstadoDatosEmpresa } from "@/app/convenio/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconoCandado, IconoDocumento, IconoUbicacion, IconoWhatsapp } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cx } from "@/components/ui/cx";
import { inicialesConvenio } from "@/components/pantallas/ListaConvenios";
import type { FichaConvenio } from "@/lib/convenio/servidor";

const VACIO: EstadoDatosEmpresa = {};
const LOGO_MAX = 1024 * 1024;

function lineas(texto: string) {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Tarjeta de una sección del formulario, con su ícono de color. */
function Bloque({
  id,
  titulo,
  descripcion,
  icono,
  tono,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  icono: ReactNode;
  tono: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} id={id} className="flex scroll-mt-6 flex-col gap-4 rounded-24 bg-white p-5 shadow-[0_8px_24px_-16px_rgba(20,73,58,0.35)] sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-14", tono)}>
          {icono}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 id={`${id}-titulo`} className="m-0 font-display text-18 font-semibold text-ga-navy">
            {titulo}
          </h2>
          <p className="m-0 text-14 text-ga-texto-2">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Formulario de «Mi empresa» con vista previa en vivo de la ficha tal como la
 * ve el asociado (como el editor del perfil de negocio de Google). Nombre y
 * NIT se muestran bloqueados: los cambia la cooperativa.
 */
export function FormularioEmpresa({ ficha }: { ficha: FichaConvenio }) {
  const [estado, accion, guardando] = useActionState(guardarDatosEmpresa, VACIO);
  const e = estado.errores ?? {};
  const v = estado.valores;

  const [especialidad, setEspecialidad] = useState(v?.especialidad ?? ficha.especialidad);
  const [descripcion, setDescripcion] = useState(v?.descripcion ?? ficha.descripcion ?? "");
  const [servicios, setServicios] = useState(v?.servicios ?? ficha.servicios.join("\n"));
  const [sedes, setSedes] = useState(v?.sedes ?? ficha.sedes.join("\n"));
  const [telefono, setTelefono] = useState(v?.telefonoContacto ?? ficha.telefono ?? "");
  const [logoLocal, setLogoLocal] = useState<string | null>(null);
  const [quitarLogo, setQuitarLogo] = useState(false);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (logoLocal) URL.revokeObjectURL(logoLocal);
  }, [logoLocal]);

  // Tras un error, el foco va al primer campo marcado.
  useEffect(() => {
    const primero = Object.keys(estado.errores ?? {})[0];
    if (primero) document.getElementById(`empresa-${primero}`)?.focus();
  }, [estado]);

  function elegirLogo(archivos: FileList | null) {
    const archivo = archivos?.[0];
    setErrorLogo(null);
    if (!archivo) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
      setErrorLogo("El logo debe ser PNG, JPG o WebP.");
      if (entradaLogo.current) entradaLogo.current.value = "";
      return;
    }
    if (archivo.size > LOGO_MAX) {
      setErrorLogo("El logo puede pesar máximo 1 MB.");
      if (entradaLogo.current) entradaLogo.current.value = "";
      return;
    }
    setQuitarLogo(false);
    setLogoLocal(URL.createObjectURL(archivo));
  }

  const logoVista = logoLocal ?? (quitarLogo ? null : ficha.logoUrl);
  const listaServicios = lineas(servicios);
  const listaSedes = lineas(sedes);
  const digitos = telefono.replace(/\D/g, "");
  const telefonoTexto = /^3[0-9]{9}$/.test(digitos) ? digitos.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3") : null;

  return (
    <form action={accion} noValidate className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        {estado.errorGeneral ? (
          <p role="alert" className="m-0 rounded-16 bg-ga-error-fondo px-4 py-3 text-15 font-semibold text-ga-error-texto">
            {estado.errorGeneral}
          </p>
        ) : null}

        <Bloque
          id="campo-logo"
          titulo="Tu marca"
          descripcion="El logo aparece en tu ficha y en cada publicación."
          tono="bg-ga-verde-tint text-ga-verde"
          icono={<span className="font-display text-16 font-semibold">{inicialesConvenio(ficha.nombre)}</span>}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-20 bg-ga-fondo-suave shadow-[inset_0_0_0_1px_var(--ga-linea)]">
              {logoVista ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoVista} alt="Vista previa del logo" className="h-full w-full object-contain p-2" />
              ) : (
                <span className="font-display text-34 font-semibold text-ga-verde">{inicialesConvenio(ficha.nombre)}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-full bg-ga-verde px-5 text-15 font-semibold text-white hover:bg-ga-verde-oscuro focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ga-verde">
                {logoVista ? "Cambiar logo" : "Subir logo"}
                <input
                  ref={entradaLogo}
                  id="empresa-logo"
                  type="file"
                  name="logo"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-describedby="empresa-logo-ayuda"
                  onChange={(ev) => elegirLogo(ev.target.files)}
                />
              </label>
              <span id="empresa-logo-ayuda" className="text-13 text-ga-texto-3">
                PNG, JPG o WebP de máximo 1 MB. Mejor si es cuadrado y con fondo blanco.
              </span>
              {ficha.logoUrl && !logoLocal ? (
                <label className="flex items-center gap-2 text-14 text-ga-texto-2">
                  <input type="checkbox" name="quitarLogo" checked={quitarLogo} onChange={(ev) => setQuitarLogo(ev.target.checked)} />
                  Quitar el logo actual
                </label>
              ) : null}
              {errorLogo || e.logo ? <span className="text-13 font-semibold text-ga-error">{errorLogo ?? e.logo}</span> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-16 bg-ga-fondo-suave p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-13 text-ga-texto-3">Nombre de la empresa</span>
              <span className="text-15 font-semibold text-ga-texto">{ficha.nombre}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-13 text-ga-texto-3">NIT</span>
              <span className="text-15 font-semibold text-ga-texto">{ficha.nit ?? "Sin NIT"}</span>
            </div>
            <p className="m-0 flex items-center gap-2 text-13 text-ga-texto-3 sm:col-span-2">
              <IconoCandado tamano={15} /> Para cambiar el nombre o el NIT, escríbele a la cooperativa.
            </p>
          </div>
        </Bloque>

        <Bloque
          id="campo-descripcion"
          titulo="Qué ofreces"
          descripcion="Cuéntale al asociado a qué te dedicas y qué beneficio le das."
          tono="bg-ga-ambar-fondo text-ga-ambar-texto"
          icono={<IconoDocumento tamano={22} />}
        >
          <Field id="empresa-especialidad" label="Especialidad" error={e.especialidad} ayuda="Una o dos palabras, por ejemplo «Odontología» o «Viajes».">
            {(control) => <Input {...control} name="especialidad" maxLength={80} value={especialidad} onChange={(ev) => setEspecialidad(ev.target.value)} />}
          </Field>
          <Field id="empresa-descripcion" label="Descripción" opcional error={e.descripcion} ayuda={`${descripcion.length} de 1000`}>
            {(control) => (
              <Textarea {...control} name="descripcion" rows={5} maxLength={1000} value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} />
            )}
          </Field>
          <div id="campo-servicios" className="scroll-mt-6">
            <Field id="empresa-servicios" label="Servicios" opcional error={e.servicios} ayuda={`Uno por línea, hasta 20. Llevas ${listaServicios.length}.`}>
              {(control) => (
                <Textarea
                  {...control}
                  name="servicios"
                  rows={5}
                  value={servicios}
                  onChange={(ev) => setServicios(ev.target.value)}
                  placeholder={"Limpieza dental\nOrtodoncia\nBlanqueamiento"}
                />
              )}
            </Field>
          </div>
        </Bloque>

        <Bloque
          id="campo-telefono"
          titulo="Contacto y sedes"
          descripcion="Por aquí te escriben los asociados que quieren el beneficio."
          tono="bg-ga-verde-tint text-ga-verde"
          icono={<IconoWhatsapp tamano={22} />}
        >
          <Field id="empresa-telefonoContacto" label="WhatsApp" opcional error={e.telefonoContacto} ayuda="Celular de 10 dígitos, empieza por 3.">
            {(control) => (
              <Input {...control} name="telefonoContacto" inputMode="numeric" autoComplete="tel-national" value={telefono} onChange={(ev) => setTelefono(ev.target.value)} />
            )}
          </Field>
          <div id="campo-sedes" className="scroll-mt-6">
            <Field id="empresa-sedes" label="Sedes" opcional error={e.sedes} ayuda="Una dirección por línea, hasta 10. Déjalo vacío si atiendes solo en línea.">
              {(control) => <Textarea {...control} name="sedes" rows={3} value={sedes} onChange={(ev) => setSedes(ev.target.value)} />}
            </Field>
          </div>
        </Bloque>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 bg-ga-fondo-suave/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-20 sm:bg-white sm:px-5 sm:shadow-[0_8px_24px_-12px_rgba(20,73,58,0.35)]">
          <span className="text-14 text-ga-texto-2">Los cambios se ven al instante en la ficha de los asociados.</span>
          <Button type="submit" disabled={guardando} className="sm:w-auto sm:px-8">
            {guardando ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </div>

      <aside aria-label="Vista previa" className="flex flex-col gap-3 lg:sticky lg:top-6">
        <div className="flex flex-col gap-4 overflow-hidden rounded-24 bg-white p-5 shadow-[0_12px_32px_-16px_rgba(20,73,58,0.45)]">
          <span className="self-start rounded-full bg-ga-ambar-fondo px-3 py-1 text-13 font-semibold text-ga-ambar-texto">
            Vista previa · así te ven los asociados
          </span>
          <div className="flex items-center gap-3.5">
            {logoVista ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoVista} alt="" className="h-16 w-16 shrink-0 rounded-12 bg-white object-contain p-1 shadow-[inset_0_0_0_1px_var(--ga-linea)]" />
            ) : (
              <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-12 bg-ga-verde-claro font-display text-20 font-semibold text-ga-verde">
                {inicialesConvenio(ficha.nombre)}
              </span>
            )}
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-12 font-semibold text-ga-verde">{especialidad.trim() || "Tu especialidad"}</span>
              <span className="font-display text-20 font-semibold leading-tight text-ga-navy">{ficha.nombre}</span>
            </div>
          </div>
          <p className={cx("m-0 line-clamp-5 text-14 leading-150", descripcion.trim() ? "text-ga-texto-2" : "italic text-ga-texto-3")}>
            {descripcion.trim() || "Aquí va la descripción de tu empresa."}
          </p>
          {listaServicios.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-14 font-semibold text-ga-navy">Servicios</span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-14 text-ga-texto-2">
                {listaServicios.slice(0, 5).map((s) => (
                  <li key={s} className="flex items-baseline gap-2.5">
                    <span aria-hidden="true" className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-ga-verde" />
                    {s}
                  </li>
                ))}
                {listaServicios.length > 5 ? <li className="text-13 text-ga-texto-3">y {listaServicios.length - 5} más</li> : null}
              </ul>
            </div>
          ) : null}
          {listaSedes.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-13 text-ga-texto-2">
              {listaSedes.slice(0, 3).map((s) => (
                <li key={s} className="flex items-start gap-1.5">
                  <IconoUbicacion tamano={15} className="mt-0.5 shrink-0 text-ga-verde" />
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
          <span
            className={cx(
              "flex h-11 items-center justify-center gap-2 rounded-full text-14 font-semibold",
              telefonoTexto ? "bg-ga-verde text-white" : "bg-ga-fondo-suave text-ga-texto-3",
            )}
          >
            <IconoWhatsapp tamano={18} apagado={!telefonoTexto} />
            {telefonoTexto ? `Escribir por WhatsApp · ${telefonoTexto}` : "Sin WhatsApp todavía"}
          </span>
        </div>
      </aside>
    </form>
  );
}
