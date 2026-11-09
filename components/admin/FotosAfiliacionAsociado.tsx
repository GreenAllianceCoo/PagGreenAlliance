"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { guardarCambioFotoAfiliacion, prepararCambioFotoAfiliacion } from "@/app/admin/asociados/fotos-actions";
import {
  ACEPTA_FOTO_AFILIACION,
  ETIQUETA_FOTO_AFILIACION,
  TEXTO_FORMATOS_FOTO_AFILIACION,
  errorDeArchivoFotoAfiliacion,
} from "@/lib/fotosAfiliacionAdmin";
import { createClient } from "@/lib/supabase/client";
import type { CampoFoto } from "@/lib/validaciones/afiliacion";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";
import { CLASE_ARCHIVO_ADMIN } from "./ComprobanteDesembolsoAdmin";
import { FotoAfiliacion } from "./FotoAfiliacion";

type Props = {
  asociadoId: string;
  nombre: string;
  /** null: el asociado no tiene afiliación aprobada (no hay fotos que ver ni cambiar). */
  fotos: { campo: CampoFoto; url: string | null }[] | null;
  /** El propio admin o uno de sus clientes: otro admin debe cambiarlas. */
  bloqueado?: boolean;
};

/**
 * «Fotos de afiliación» (solo admin, pedido de Sebas 8-nov): cédula por los dos lados y
 * la selfie, cada una con «Cambiar». La foto nueva sube directo a Storage con URL firmada
 * y el servidor la verifica antes de ligarla; la anterior queda en «Cambios».
 */
export function FotosAfiliacionAsociado({ asociadoId, nombre, fotos, bloqueado = false }: Props) {
  const [editando, setEditando] = useState<CampoFoto | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  return (
    <section aria-labelledby="titulo-fotos-afiliacion" className="flex flex-col gap-3.5 rounded-20 bg-admin-superficie p-5.5">
      <h2 id="titulo-fotos-afiliacion" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Fotos de afiliación
      </h2>
      {fotos === null ? (
        <p className="m-0 text-14 text-admin-texto-2">No tiene una afiliación aprobada con fotos.</p>
      ) : (
        <>
          {aviso ? (
            <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
              {aviso}
            </p>
          ) : null}
          <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-3" data-testid="fotos-afiliacion-admin">
            {fotos.map((f) => (
              <li key={f.campo} className="flex flex-col gap-2">
                {/* key con la URL: al cambiar la foto, el visor vuelve a «cargando». */}
                <FotoAfiliacion key={f.url ?? "sin-url"} etiqueta={`${ETIQUETA_FOTO_AFILIACION[f.campo]} de ${nombre}`} url={f.url} />
                {editando === f.campo ? null : (
                  <button
                    type="button"
                    disabled={bloqueado}
                    title={bloqueado ? "Otro administrador debe cambiar estas fotos" : undefined}
                    onClick={() => {
                      setAviso(null);
                      setEditando(f.campo);
                    }}
                    className="flex h-11 items-center justify-center rounded-full px-4 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06] disabled:opacity-60"
                  >
                    Cambiar {ETIQUETA_FOTO_AFILIACION[f.campo].toLowerCase()}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editando ? (
            <FormularioCambioFoto
              key={editando}
              asociadoId={asociadoId}
              campo={editando}
              onCancelar={() => setEditando(null)}
              onGuardado={(mensaje) => {
                setEditando(null);
                setAviso(mensaje);
              }}
            />
          ) : null}
        </>
      )}
    </section>
  );
}

function FormularioCambioFoto({
  asociadoId,
  campo,
  onCancelar,
  onGuardado,
}: {
  asociadoId: string;
  campo: CampoFoto;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errores, setErrores] = useState<{ archivo?: string; motivo?: string; general?: string }>({});
  const [ocupado, setOcupado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const prefijo = `foto-${campo}-${asociadoId}`;

  async function alEnviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ocupado) return;
    const malArchivo = archivo ? errorDeArchivoFotoAfiliacion(archivo) : "Elige la foto nueva.";
    const malMotivo = motivo.trim().length < 5 ? "El motivo debe tener entre 5 y 300 caracteres." : undefined;
    if (!archivo || malArchivo || malMotivo) {
      setErrores({ archivo: malArchivo ?? undefined, motivo: malMotivo });
      if (malArchivo) entrada.current?.focus();
      return;
    }
    setOcupado(true);
    setErrores({});
    const preparada = await prepararCambioFotoAfiliacion({ asociadoId, campo, tipo: archivo.type, tamano: archivo.size });
    if (!preparada.ok) {
      setOcupado(false);
      setErrores({ general: preparada.error });
      return;
    }
    const { error: errorSubida } = await createClient()
      .storage.from(preparada.bucket)
      .uploadToSignedUrl(preparada.ruta, preparada.token, archivo, { contentType: archivo.type });
    if (errorSubida) {
      setOcupado(false);
      setErrores({ general: "No pudimos subir la foto. Revisa tu conexión e intenta de nuevo." });
      return;
    }
    const r = await guardarCambioFotoAfiliacion({ asociadoId, campo, ruta: preparada.ruta, motivo });
    setOcupado(false);
    if (r.error) {
      setErrores({ general: r.error });
      return;
    }
    // Nuevas URLs firmadas para las fotos.
    router.refresh();
    onGuardado(r.mensaje ?? "Foto actualizada.");
  }

  return (
    <form
      onSubmit={alEnviar}
      noValidate
      className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-ambar)] motion-safe:animate-ga-aparecer"
    >
      <p className="m-0 text-15 font-extrabold text-admin-texto">Cambiar {ETIQUETA_FOTO_AFILIACION[campo].toLowerCase()}</p>
      <CampoAdmin id={`${prefijo}-archivo`} label="Foto nueva" ayuda={TEXTO_FORMATOS_FOTO_AFILIACION} error={errores.archivo}>
        {(c) => (
          <input
            {...c}
            ref={entrada}
            name="foto"
            type="file"
            accept={ACEPTA_FOTO_AFILIACION}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setArchivo(f);
              setErrores((prev) => ({ ...prev, archivo: f ? (errorDeArchivoFotoAfiliacion(f) ?? undefined) : undefined }));
            }}
            className={CLASE_ARCHIVO_ADMIN}
          />
        )}
      </CampoAdmin>
      <CampoAdmin
        id={`${prefijo}-motivo`}
        label="Motivo del cambio"
        ayuda="Obligatorio. Queda en «Cambios» junto con la foto anterior."
        error={errores.motivo}
      >
        {(c) => <EntradaAdmin {...c} name="motivo" required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />}
      </CampoAdmin>
      {errores.general ? (
        <p role="alert" className="m-0 text-13 font-semibold text-admin-rojo-2">
          {errores.general}
        </p>
      ) : null}
      <div className="flex gap-2.5">
        <BotonAdmin textoCargando="Subiendo…" cargando={ocupado} className="h-11.5 flex-1">
          Guardar foto
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
