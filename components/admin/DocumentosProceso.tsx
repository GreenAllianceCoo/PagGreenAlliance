"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import {
  guardarDocumentoProceso,
  prepararSubidaDocumentoProceso,
  quitarDocumentoProceso,
  urlDescargaDocumentoProceso,
} from "@/app/admin/asociados/documentos-actions";
import { TEXTO_FORMATO_DOCUMENTO_PROCESO, errorDeArchivoDocumentoProceso, formatearTamanoArchivo } from "@/lib/documentosProceso";
import { createClient } from "@/lib/supabase/client";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";
import { CLASE_ARCHIVO_ADMIN } from "./ComprobanteDesembolsoAdmin";

export type DocumentoProcesoVista = {
  id: string;
  nombre: string;
  tamanoBytes: number;
  subidoEl: string;
  subidoPor: string;
};

type Props = {
  asociadoId: string;
  documentos: DocumentoProcesoVista[];
  /** No se pudo leer la lista (se muestra el aviso en vez de «Sin documentos»). */
  errorLista?: boolean;
  /** El propio admin: otro admin debe manejar su proceso. */
  bloqueado?: boolean;
};

/**
 * «Documentos del proceso» (solo admin, pedido de Sebas 8-nov): varios PDF por asociado,
 * cada uno con nombre, fecha, quién lo subió, «Descargar» y «Quitar» (con motivo). Subir y
 * quitar quedan en «Cambios».
 */
export function DocumentosProceso({ asociadoId, documentos, errorLista = false, bloqueado = false }: Props) {
  const router = useRouter();
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [descargando, setDescargando] = useState<string | null>(null);

  async function descargar(id: string) {
    setDescargando(id);
    setError(null);
    const r = await urlDescargaDocumentoProceso({ documentoId: id });
    setDescargando(null);
    if (!r.url) {
      setError(r.error ?? "No pudimos descargar el documento.");
      return;
    }
    // La URL firmada trae «download=<nombre>.pdf»: el navegador lo guarda sin salir de la página.
    window.location.assign(r.url);
  }

  return (
    <section aria-labelledby="titulo-documentos-proceso" className="flex flex-col gap-3.5 rounded-20 bg-admin-superficie p-5.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="titulo-documentos-proceso" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
          Documentos del proceso
        </h2>
        {subiendo ? null : (
          <button
            type="button"
            disabled={bloqueado}
            title={bloqueado ? "Otro administrador debe subir los documentos de tu proceso" : undefined}
            onClick={() => {
              setAviso(null);
              setError(null);
              setSubiendo(true);
            }}
            className="flex h-11 items-center rounded-full px-4.5 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06] disabled:opacity-60"
          >
            Subir PDF
          </button>
        )}
      </div>

      {aviso ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {error}
        </p>
      ) : null}

      {subiendo ? (
        <FormularioSubida
          asociadoId={asociadoId}
          onCancelar={() => setSubiendo(false)}
          onGuardado={(mensaje) => {
            setSubiendo(false);
            setAviso(mensaje);
            router.refresh();
          }}
        />
      ) : null}

      {errorLista ? (
        <p className="m-0 text-14 text-admin-rojo-2">No pudimos cargar los documentos. Recarga la página.</p>
      ) : documentos.length === 0 ? (
        <p className="m-0 text-14 text-admin-texto-2">Sin documentos todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="documentos-proceso">
          {documentos.map((d) => (
            <li key={d.id} className="flex flex-col gap-2.5 rounded-14 bg-admin-superficie-2 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="break-words text-15 font-bold text-admin-texto">{d.nombre}</span>
                  <span className="text-13 text-admin-texto-3">
                    PDF · {formatearTamanoArchivo(d.tamanoBytes)} · {d.subidoEl} · {d.subidoPor}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => descargar(d.id)}
                    disabled={descargando === d.id}
                    aria-busy={descargando === d.id || undefined}
                    aria-label={`Descargar ${d.nombre}`}
                    className="flex h-11 items-center rounded-full bg-admin-verde px-4.5 text-14 font-extrabold text-admin-fondo disabled:opacity-80"
                  >
                    {descargando === d.id ? "Preparando…" : "Descargar"}
                  </button>
                  {quitando === d.id ? null : (
                    <button
                      type="button"
                      disabled={bloqueado}
                      onClick={() => {
                        setAviso(null);
                        setQuitando(d.id);
                      }}
                      aria-label={`Quitar ${d.nombre}`}
                      className="flex h-11 items-center rounded-full px-4 text-14 font-bold text-admin-rojo-2 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-rojo-fondo disabled:opacity-60"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              </div>
              {quitando === d.id ? (
                <FormularioQuitar
                  asociadoId={asociadoId}
                  documento={d}
                  onCancelar={() => setQuitando(null)}
                  onQuitado={(mensaje) => {
                    setQuitando(null);
                    setAviso(mensaje);
                    router.refresh();
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FormularioSubida({
  asociadoId,
  onCancelar,
  onGuardado,
}: {
  asociadoId: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [errores, setErrores] = useState<{ archivo?: string; nombre?: string; general?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const prefijo = `documento-${asociadoId}`;

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const malArchivo = archivo ? errorDeArchivoDocumentoProceso(archivo) : "Elige el PDF.";
    const largo = nombre.trim().replace(/\s+/g, " ").length;
    const malNombre = largo < 3 || largo > 120 ? "El nombre debe tener entre 3 y 120 caracteres." : undefined;
    if (!archivo || malArchivo || malNombre) {
      setErrores({ archivo: malArchivo ?? undefined, nombre: malNombre });
      if (malArchivo) entrada.current?.focus();
      return;
    }
    setOcupado(true);
    setErrores({});
    const preparada = await prepararSubidaDocumentoProceso({ asociadoId, tamano: archivo.size });
    if (!preparada.ok) {
      setOcupado(false);
      setErrores({ general: preparada.error });
      return;
    }
    const { error: errorSubida } = await createClient()
      .storage.from(preparada.bucket)
      .uploadToSignedUrl(preparada.ruta, preparada.token, archivo, { contentType: "application/pdf" });
    if (errorSubida) {
      setOcupado(false);
      setErrores({ general: "No pudimos subir el documento. Revisa tu conexión e intenta de nuevo." });
      return;
    }
    const r = await guardarDocumentoProceso({ asociadoId, ruta: preparada.ruta, nombre });
    setOcupado(false);
    if (r.error) {
      setErrores({ general: r.error });
      return;
    }
    onGuardado(r.mensaje ?? "Documento guardado.");
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
    >
      <CampoAdmin
        id={`${prefijo}-nombre`}
        label="Nombre del documento"
        ayuda="Por ejemplo: «Demanda ejecutiva» o «Auto que libra mandamiento»."
        error={errores.nombre}
      >
        {(c) => <EntradaAdmin {...c} name="nombre" required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} />}
      </CampoAdmin>
      <CampoAdmin id={`${prefijo}-archivo`} label="Archivo" ayuda={TEXTO_FORMATO_DOCUMENTO_PROCESO} error={errores.archivo}>
        {(c) => (
          <input
            {...c}
            ref={entrada}
            name="documento"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              setErrores((prev) => ({ ...prev, archivo: f ? (errorDeArchivoDocumentoProceso(f) ?? undefined) : undefined }));
              // Si no escribió nombre, propone el del archivo (sin «.pdf»).
              if (f && !nombre.trim()) setNombre(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").slice(0, 120));
            }}
            className={CLASE_ARCHIVO_ADMIN}
          />
        )}
      </CampoAdmin>
      {errores.general ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {errores.general}
        </p>
      ) : null}
      <div className="flex gap-2.5">
        <BotonAdmin textoCargando="Subiendo…" cargando={ocupado} className="h-11.5 flex-1">
          Guardar documento
        </BotonAdmin>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioQuitar({
  asociadoId,
  documento,
  onCancelar,
  onQuitado,
}: {
  asociadoId: string;
  documento: DocumentoProcesoVista;
  onCancelar: () => void;
  onQuitado: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    if (motivo.trim().length < 5) {
      setError("El motivo debe tener entre 5 y 300 caracteres.");
      return;
    }
    setOcupado(true);
    setError(null);
    const r = await quitarDocumentoProceso({ asociadoId, documentoId: documento.id, motivo });
    setOcupado(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onQuitado(r.mensaje ?? "Documento quitado.");
  }

  return (
    <form onSubmit={alEnviar} noValidate className="flex flex-col gap-2.5 border-t border-admin-borde-sutil pt-2.5">
      <CampoAdmin
        id={`quitar-${documento.id}`}
        label={`Motivo para quitar «${documento.nombre}»`}
        ayuda="El archivo se borra; el registro y el motivo quedan en «Cambios»."
        error={error ?? undefined}
      >
        {(c) => <EntradaAdmin {...c} name="motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </CampoAdmin>
      <div className="flex gap-2.5">
        <BotonAdmin variante="rojo" textoCargando="Quitando…" cargando={ocupado} className="flex-1">
          Quitar documento
        </BotonAdmin>
        <button
          type="button"
          onClick={onCancelar}
          disabled={ocupado}
          className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
