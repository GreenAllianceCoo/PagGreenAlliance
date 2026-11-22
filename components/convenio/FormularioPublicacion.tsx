"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  descartarArchivo,
  guardarPublicacion,
  pedirSubidaPdf,
  subirImagenPublicacion,
  type EstadoPublicacionForm,
} from "@/app/convenio/actions";
import { TarjetaPublicacion } from "@/components/convenio/TarjetaPublicacion";
import { Button, clasesBoton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { IconoDocumento } from "@/components/ui/Iconos";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cx } from "@/components/ui/cx";
import { reducirImagen } from "@/lib/convenio/imagenCliente";
import {
  BUCKET_PUBLICACIONES,
  errorDeArchivos,
  errorDeImagen,
  errorDePdf,
  MAX_IMAGENES_CATALOGO,
  NOMBRE_TIPO,
  type TipoPublicacion,
} from "@/lib/convenio/publicaciones";
import { createClient } from "@/lib/supabase/client";

type ArchivoSubido = {
  clave: string;
  /** Ruta en el bucket (cuando terminó de subir). */
  ruta?: string;
  /** Vista previa (URL local o firmada). */
  url?: string;
  nombre: string;
  estado: "subiendo" | "lista" | "error";
  error?: string;
  /** Ya estaba guardado en la publicación (no se descarta del bucket al quitarlo). */
  guardado?: boolean;
};

export type InicialPublicacion = {
  titulo: string;
  descripcion: string;
  beneficio: string;
  iniciaEl: string;
  terminaEl: string;
  imagenes: { ruta: string; url: string | null }[];
  pdf: { ruta: string } | null;
};

type Props = {
  modo: "nueva" | "editar";
  tipo: TipoPublicacion;
  publicacionId: string;
  convenio: { nombre: string; logoUrl: string | null };
  hoy: string;
  inicial?: InicialPublicacion;
};

const VACIO: EstadoPublicacionForm = {};
let contador = 0;
const nuevaClave = () => `a${++contador}`;

/** Crear o editar una promoción o un catálogo, con vista previa (docs/spec-convenios.md §B3). */
export function FormularioPublicacion({ modo, tipo, publicacionId, convenio, hoy, inicial }: Props) {
  const [estado, accion, guardando] = useActionState(guardarPublicacion, VACIO);
  const v = estado.valores;
  const e = estado.errores ?? {};

  const [titulo, setTitulo] = useState(v?.titulo ?? inicial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(v?.descripcion ?? inicial?.descripcion ?? "");
  const [beneficio, setBeneficio] = useState(v?.beneficio ?? inicial?.beneficio ?? "");
  const [iniciaEl, setIniciaEl] = useState(v?.iniciaEl ?? inicial?.iniciaEl ?? (tipo === "promocion" ? hoy : ""));
  const [terminaEl, setTerminaEl] = useState(v?.terminaEl ?? inicial?.terminaEl ?? "");
  const [imagenes, setImagenes] = useState<ArchivoSubido[]>(
    () => inicial?.imagenes.map((i) => ({ clave: nuevaClave(), ruta: i.ruta, url: i.url ?? undefined, nombre: "Imagen", estado: "lista", guardado: true })) ?? [],
  );
  const [pdf, setPdf] = useState<ArchivoSubido | null>(
    inicial?.pdf ? { clave: nuevaClave(), ruta: inicial.pdf.ruta, nombre: "Catálogo en PDF", estado: "lista", guardado: true } : null,
  );
  const [formato, setFormato] = useState<"imagenes" | "pdf">(inicial?.pdf ? "pdf" : "imagenes");
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const urlsLocales = useRef<string[]>([]);

  useEffect(() => () => urlsLocales.current.forEach((u) => URL.revokeObjectURL(u)), []);
  useEffect(() => {
    const primero = Object.keys(estado.errores ?? {})[0];
    if (primero) document.getElementById(`publicacion-${primero}`)?.focus();
    else if (estado.errorGeneral) document.getElementById("publicacion-error")?.focus();
  }, [estado]);

  const subiendo = imagenes.some((i) => i.estado === "subiendo") || pdf?.estado === "subiendo";
  const listas = imagenes.filter((i) => i.estado === "lista" && i.ruta);
  const usaPdf = tipo === "catalogo" && formato === "pdf";
  const maxImagenes = tipo === "promocion" ? 1 : MAX_IMAGENES_CATALOGO;

  function descartar(archivo: ArchivoSubido) {
    if (archivo.ruta && !archivo.guardado) {
      const fd = new FormData();
      fd.set("publicacionId", publicacionId);
      fd.set("ruta", archivo.ruta);
      void descartarArchivo(fd);
    }
  }

  async function elegirImagenes(lista: FileList | null) {
    setErrorArchivo(null);
    if (!lista || lista.length === 0) return;
    const elegidas = Array.from(lista);
    const espacio = tipo === "promocion" ? 1 : maxImagenes - imagenes.length;
    if (espacio <= 0) {
      setErrorArchivo(`Máximo ${maxImagenes} imágenes.`);
      return;
    }
    if (tipo === "promocion") {
      imagenes.forEach(descartar);
      setImagenes([]);
    }
    for (const archivo of elegidas.slice(0, espacio)) {
      const clave = nuevaClave();
      const error = errorDeImagen(archivo);
      const url = URL.createObjectURL(archivo);
      urlsLocales.current.push(url);
      if (error) {
        setImagenes((xs) => [...xs, { clave, url, nombre: archivo.name, estado: "error", error }]);
        continue;
      }
      setImagenes((xs) => [...xs, { clave, url, nombre: archivo.name, estado: "subiendo" }]);
      const reducida = await reducirImagen(archivo);
      let resultado: { ruta?: string; error?: string };
      if (!reducida) {
        resultado = { error: "No pudimos reducir esa imagen. Prueba con otra." };
      } else {
        const fd = new FormData();
        fd.set("publicacionId", publicacionId);
        fd.set("archivo", reducida);
        resultado = await subirImagenPublicacion(fd).catch(() => ({ error: "No pudimos subir la imagen. Intenta de nuevo." }));
      }
      setImagenes((xs) =>
        xs.map((x) => (x.clave === clave ? { ...x, ruta: resultado.ruta, estado: resultado.ruta ? "lista" : "error", error: resultado.error } : x)),
      );
    }
    if (elegidas.length > espacio) setErrorArchivo(`Solo se agregaron ${espacio}: el máximo es ${maxImagenes}.`);
  }

  async function elegirPdf(lista: FileList | null) {
    setErrorArchivo(null);
    const archivo = lista?.[0];
    if (!archivo) return;
    const error = errorDePdf(archivo);
    if (error) {
      setErrorArchivo(error);
      return;
    }
    if (pdf) descartar(pdf);
    const clave = nuevaClave();
    setPdf({ clave, nombre: archivo.name, estado: "subiendo" });
    const fd = new FormData();
    fd.set("publicacionId", publicacionId);
    const permiso = await pedirSubidaPdf(fd).catch(() => ({ error: "No pudimos preparar la subida del PDF.", ruta: undefined, token: undefined }));
    if (!permiso.ruta || !permiso.token) {
      setPdf({ clave, nombre: archivo.name, estado: "error", error: permiso.error });
      return;
    }
    const { error: errorSubida } = await createClient()
      .storage.from(BUCKET_PUBLICACIONES)
      .uploadToSignedUrl(permiso.ruta, permiso.token, archivo, { contentType: "application/pdf" });
    setPdf(
      errorSubida
        ? { clave, nombre: archivo.name, estado: "error", error: "No pudimos subir el PDF. Intenta de nuevo." }
        : { clave, ruta: permiso.ruta, nombre: archivo.name, estado: "lista" },
    );
  }

  function quitarImagen(clave: string) {
    const archivo = imagenes.find((i) => i.clave === clave);
    if (archivo) descartar(archivo);
    setImagenes((xs) => xs.filter((x) => x.clave !== clave));
  }

  function cambiarFormato(nuevo: "imagenes" | "pdf") {
    setErrorArchivo(null);
    setFormato(nuevo);
  }

  const errorDeArchivosLocal = errorDeArchivos(tipo, usaPdf ? 0 : listas.length, usaPdf && pdf?.estado === "lista");
  const nombre = NOMBRE_TIPO[tipo];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <form action={accion} noValidate className="flex flex-col gap-5 rounded-20 bg-ga-superficie p-4 shadow-[inset_0_0_0_1px_var(--ga-linea)] sm:p-6">
        <input type="hidden" name="id" value={publicacionId} />
        <input type="hidden" name="modo" value={modo} />
        <input type="hidden" name="tipo" value={tipo} />
        {usaPdf
          ? pdf?.ruta && pdf.estado === "lista" ? <input type="hidden" name="pdf" value={pdf.ruta} /> : null
          : listas.map((i) => <input key={i.clave} type="hidden" name="imagenes" value={i.ruta} />)}

        <Field id="publicacion-titulo" label="Título" error={e.titulo} ayuda={`${titulo.trim().length} de 80`}>
          {(control) => (
            <Input {...control} name="titulo" maxLength={80} value={titulo} onChange={(ev) => setTitulo(ev.target.value)} placeholder={tipo === "promocion" ? "Ejemplo: Revisión técnica gratis" : "Ejemplo: Catálogo de temporada"} />
          )}
        </Field>

        {tipo === "promocion" ? (
          <Field id="publicacion-beneficio" label="Beneficio (opcional)" error={e.beneficio} ayuda="Corto y claro, por ejemplo «20% de descuento». Se muestra sobre la imagen.">
            {(control) => <Input {...control} name="beneficio" maxLength={30} value={beneficio} onChange={(ev) => setBeneficio(ev.target.value)} />}
          </Field>
        ) : null}

        <Field
          id="publicacion-descripcion"
          label={tipo === "promocion" ? "Descripción" : "Descripción (opcional)"}
          error={e.descripcion}
          ayuda={`Qué incluye, condiciones y cómo pedirla. ${descripcion.length} de 600`}
        >
          {(control) => <Textarea {...control} name="descripcion" rows={4} maxLength={600} value={descripcion} onChange={(ev) => setDescripcion(ev.target.value)} />}
        </Field>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-1 p-0 text-15 font-semibold">{tipo === "promocion" ? "Vigencia" : "Vigencia (opcional)"}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Field id="publicacion-iniciaEl" label="Desde" error={e.iniciaEl}>
              {(control) => <Input {...control} type="date" name="iniciaEl" value={iniciaEl} onChange={(ev) => setIniciaEl(ev.target.value)} />}
            </Field>
            <Field id="publicacion-terminaEl" label="Hasta" error={e.terminaEl}>
              {(control) => <Input {...control} type="date" name="terminaEl" min={iniciaEl || hoy} value={terminaEl} onChange={(ev) => setTerminaEl(ev.target.value)} />}
            </Field>
          </div>
          <p className="m-0 text-13 text-ga-texto-3">
            {tipo === "promocion"
              ? "Se muestra desde la fecha inicial y se oculta sola al día siguiente de la final."
              : "Sin fechas, el catálogo queda publicado hasta que lo retires."}
          </p>
        </fieldset>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0" aria-describedby={e.archivos || errorArchivo ? "publicacion-archivos-error" : undefined}>
          <legend className="mb-1 p-0 text-15 font-semibold">{tipo === "promocion" ? "Imagen" : "Contenido"}</legend>
          {tipo === "catalogo" ? (
            <div role="radiogroup" aria-label="Formato del catálogo" className="flex gap-2">
              {(["imagenes", "pdf"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={formato === f}
                  onClick={() => cambiarFormato(f)}
                  className={cx(
                    "h-10 rounded-full px-4 text-14 font-semibold",
                    formato === f ? "bg-ga-navy text-white" : "bg-ga-fondo-suave text-ga-texto-2 shadow-[inset_0_0_0_1px_var(--ga-linea)]",
                  )}
                >
                  {f === "imagenes" ? "Imágenes" : "Un PDF"}
                </button>
              ))}
            </div>
          ) : null}

          {usaPdf ? (
            <div className="flex flex-col gap-2">
              {pdf ? (
                <div className="flex items-center gap-3 rounded-14 bg-ga-fondo-suave p-3">
                  <IconoDocumento tamano={22} className="shrink-0 text-ga-texto-2" />
                  <span className="min-w-0 grow truncate text-14">{pdf.nombre}</span>
                  <span className={cx("text-13", pdf.estado === "error" ? "text-ga-error-texto" : "text-ga-texto-3")}>
                    {pdf.estado === "subiendo" ? "Subiendo…" : pdf.estado === "error" ? pdf.error : "Listo"}
                  </span>
                </div>
              ) : null}
              <label className={cx(clasesBoton("secundario"), "cursor-pointer px-7 sm:self-start")}>
                {pdf ? "Cambiar PDF" : "Elegir PDF"}
                <input type="file" accept="application/pdf" className="sr-only" onChange={(ev) => void elegirPdf(ev.target.files).finally(() => (ev.target.value = ""))} />
              </label>
              <p className="m-0 text-13 text-ga-texto-3">Hasta 15 MB.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {imagenes.length > 0 ? (
                <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4">
                  {imagenes.map((i) => (
                    <li key={i.clave} className="relative overflow-hidden rounded-12 bg-ga-fondo-suave">
                      {i.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={i.url} alt="" className={cx("aspect-square w-full object-cover", i.estado !== "lista" && "opacity-50")} />
                      ) : (
                        <div className="aspect-square w-full" />
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-white/90 px-1.5 py-1 text-12">
                        {i.estado === "subiendo" ? "Subiendo…" : i.estado === "error" ? <span className="text-ga-error-texto">{i.error}</span> : "Lista"}
                      </span>
                      {i.estado !== "subiendo" ? (
                        <button
                          type="button"
                          onClick={() => quitarImagen(i.clave)}
                          aria-label="Quitar imagen"
                          className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-18 leading-none text-ga-texto shadow"
                        >
                          ×
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {imagenes.length < maxImagenes || tipo === "promocion" ? (
                <label className={cx(clasesBoton("secundario"), "cursor-pointer px-7 sm:self-start")}>
                  {tipo === "promocion" ? (imagenes.length ? "Cambiar imagen" : "Elegir imagen") : "Agregar imágenes"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple={tipo === "catalogo"}
                    className="sr-only"
                    onChange={(ev) => void elegirImagenes(ev.target.files).finally(() => (ev.target.value = ""))}
                  />
                </label>
              ) : null}
              <p className="m-0 text-13 text-ga-texto-3">
                JPG, PNG o WebP de hasta 5 MB{tipo === "catalogo" ? `, máximo ${MAX_IMAGENES_CATALOGO}` : ""}. Las reducimos para que carguen rápido.
              </p>
            </div>
          )}
          {e.archivos || errorArchivo ? (
            <span id="publicacion-archivos-error" className="text-14 font-semibold text-ga-error-texto">
              {errorArchivo ?? e.archivos}
            </span>
          ) : null}
        </fieldset>

        {estado.errorGeneral ? (
          <p id="publicacion-error" tabIndex={-1} role="alert" className="m-0 rounded-12 bg-ga-error-fondo px-4 py-3 text-15 font-semibold text-ga-error-texto">
            {estado.errorGeneral}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <Button cargando={guardando} textoCargando="Guardando…" disabled={subiendo || Boolean(errorDeArchivosLocal)} className="px-8">
            {modo === "nueva" ? "Publicar" : "Guardar cambios"}
          </Button>
          <Link href="/convenio" className={clasesBoton("terciario", "px-8")}>
            Cancelar
          </Link>
        </div>
        {subiendo ? <p className="m-0 text-13 text-ga-texto-3" role="status">Espera a que terminen de subir los archivos.</p> : null}
        {!subiendo && errorDeArchivosLocal ? <p className="m-0 text-13 text-ga-texto-3">{errorDeArchivosLocal}</p> : null}
      </form>

      <aside aria-label="Vista previa" className="flex flex-col gap-2 lg:sticky lg:top-6">
        <span className="text-14 font-semibold text-ga-texto-2">Así la verán los asociados</span>
        <TarjetaPublicacion
          datos={{
            tipo,
            titulo: titulo.trim() || nombre.nuevo,
            descripcion: descripcion.trim() || null,
            beneficio: tipo === "promocion" ? beneficio.trim() || null : null,
            terminaEl: terminaEl || null,
            portada: usaPdf ? null : (imagenes.find((i) => i.url && i.estado !== "error")?.url ?? null),
            totalImagenes: listas.length,
            esPdf: usaPdf,
            convenio,
            nuevo: true,
          }}
        />
      </aside>
    </div>
  );
}
