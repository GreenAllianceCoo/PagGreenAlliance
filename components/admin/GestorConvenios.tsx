"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  alternarVisibilidadConvenio,
  eliminarConvenio,
  guardarConvenio,
  moverConvenio,
  type EstadoAccionConvenio,
  type EstadoGuardarConvenio,
} from "@/app/admin/convenios/actions";
import type { ConvenioAdmin } from "@/lib/admin/convenios";

const VACIO: EstadoGuardarConvenio = {};
const ACCION_VACIA: EstadoAccionConvenio = {};

const CLASE_CONTROL =
  "rounded-12 bg-admin-fondo px-3.5 text-16 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none placeholder:text-admin-texto-3 aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)] focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]";
const CLASE_BOTON_SECUNDARIO =
  "flex h-11 items-center justify-center rounded-10 px-4 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie disabled:opacity-40";

function Campo({
  id,
  label,
  error,
  ayuda,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  ayuda?: string;
  children: (describedBy: string | undefined, invalido: boolean) => React.ReactNode;
}) {
  const ids = [error ? `${id}-error` : null, ayuda ? `${id}-ayuda` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-14 font-extrabold">
        {label}
      </label>
      {children(ids, Boolean(error))}
      {ayuda ? (
        <span id={`${id}-ayuda`} className="text-12 text-admin-texto-3">
          {ayuda}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-12 font-bold text-admin-rojo-2">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function BotonGuardar({ nuevo }: { nuevo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex h-12 items-center gap-2 self-start rounded-full bg-admin-verde px-7 text-15 font-extrabold text-admin-fondo disabled:opacity-85"
    >
      {pending ? "Guardando…" : nuevo ? "Crear convenio" : "Guardar cambios"}
    </button>
  );
}

/** Formulario de crear/editar (con logo). El primer campo con error recibe el foco. */
function FormularioConvenio({ convenio, onCerrar }: { convenio?: ConvenioAdmin; onCerrar: () => void }) {
  const [estado, accion] = useActionState(guardarConvenio, VACIO);
  const v = estado.valores;
  const p = (campo: keyof NonNullable<typeof v>, inicial: string) => (v ? String(v[campo] ?? "") : inicial);
  const e = estado.errores ?? {};

  useEffect(() => {
    if (estado.guardado) onCerrar();
  }, [estado.guardado, onCerrar]);

  useEffect(() => {
    const primero = Object.keys(estado.errores ?? {})[0];
    if (primero) document.getElementById(`convenio-${primero}`)?.focus();
  }, [estado]);

  const control = (describedBy: string | undefined, invalido: boolean) => ({
    "aria-describedby": describedBy,
    "aria-invalid": invalido ? true : undefined,
  });

  return (
    <form action={accion} noValidate className="flex flex-col gap-4 rounded-20 bg-admin-superficie p-5.5">
      <h2 className="m-0 font-display text-20 font-extrabold">{convenio ? `Editar «${convenio.nombreEmpresa}»` : "Nuevo convenio"}</h2>
      <input type="hidden" name="id" value={convenio?.id ?? ""} />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Campo id="convenio-nombreEmpresa" label="Nombre de la empresa" error={e.nombreEmpresa}>
          {(d, i) => (
            <input id="convenio-nombreEmpresa" name="nombreEmpresa" required defaultValue={p("nombreEmpresa", convenio?.nombreEmpresa ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />
          )}
        </Campo>
        <Campo id="convenio-especialidad" label="Especialidad" error={e.especialidad}>
          {(d, i) => (
            <input id="convenio-especialidad" name="especialidad" required defaultValue={p("especialidad", convenio?.especialidad ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />
          )}
        </Campo>
        <Campo id="convenio-nit" label="NIT" error={e.nit} ayuda="Opcional. Ejemplo: 902.038.118-7">
          {(d, i) => <input id="convenio-nit" name="nit" defaultValue={p("nit", convenio?.nit ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />}
        </Campo>
        <Campo id="convenio-emoji" label="Emoji" error={e.emoji}>
          {(d, i) => <input id="convenio-emoji" name="emoji" defaultValue={p("emoji", convenio?.emoji ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />}
        </Campo>
        <Campo id="convenio-telefonoContacto" label="WhatsApp del convenio" error={e.telefonoContacto} ayuda="10 dígitos, empieza por 3. Sin +57.">
          {(d, i) => (
            <input id="convenio-telefonoContacto" name="telefonoContacto" inputMode="numeric" defaultValue={p("telefonoContacto", convenio?.telefonoContacto ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />
          )}
        </Campo>
        <Campo id="convenio-orden" label="Orden" error={e.orden} ayuda="Menor número se muestra primero.">
          {(d, i) => (
            <input id="convenio-orden" name="orden" inputMode="numeric" defaultValue={p("orden", String(convenio?.orden ?? 100))} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />
          )}
        </Campo>
      </div>
      <Campo id="convenio-descripcion" label="Descripción" error={e.descripcion}>
        {(d, i) => (
          <textarea id="convenio-descripcion" name="descripcion" rows={3} defaultValue={p("descripcion", convenio?.descripcion ?? "")} className={CLASE_CONTROL + " py-3"} {...control(d, i)} />
        )}
      </Campo>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <Campo id="convenio-servicios" label="Servicios" error={e.servicios} ayuda="Uno por línea.">
          {(d, i) => (
            <textarea id="convenio-servicios" name="servicios" rows={5} defaultValue={p("servicios", (convenio?.servicios ?? []).join("\n"))} className={CLASE_CONTROL + " py-3"} {...control(d, i)} />
          )}
        </Campo>
        <Campo id="convenio-sedes" label="Sedes" error={e.sedes} ayuda="Una por línea. Déjalo vacío si no aplica.">
          {(d, i) => (
            <textarea id="convenio-sedes" name="sedes" rows={5} defaultValue={p("sedes", (convenio?.sedes ?? []).join("\n"))} className={CLASE_CONTROL + " py-3"} {...control(d, i)} />
          )}
        </Campo>
        <Campo id="convenio-videoUrl" label="Video (ruta o enlace)" error={e.videoUrl} ayuda="Ejemplo: /convenios/amb-movil.mp4 o https://…">
          {(d, i) => <input id="convenio-videoUrl" name="videoUrl" defaultValue={p("videoUrl", convenio?.videoUrl ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />}
        </Campo>
        <Campo id="convenio-pdfUrl" label="PDF (ruta o enlace)" error={e.pdfUrl} ayuda="Si hay video y PDF, se muestra el video.">
          {(d, i) => <input id="convenio-pdfUrl" name="pdfUrl" defaultValue={p("pdfUrl", convenio?.pdfUrl ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />}
        </Campo>
        <Campo id="convenio-pdfTamano" label="Tamaño del PDF" error={e.pdfTamano} ayuda="Texto que se muestra, p. ej. 3 MB.">
          {(d, i) => <input id="convenio-pdfTamano" name="pdfTamano" defaultValue={p("pdfTamano", convenio?.pdfTamano ?? "")} className={CLASE_CONTROL + " h-12"} {...control(d, i)} />}
        </Campo>
        <Campo id="convenio-logo" label="Logo" error={e.logo} ayuda="PNG, JPG o WebP. Máximo 1 MB.">
          {(d, i) => (
            <input
              id="convenio-logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={CLASE_CONTROL + " py-2.5"}
              {...control(d, i)}
            />
          )}
        </Campo>
      </div>
      {convenio?.logoUrl ? (
        <label className="flex items-center gap-2.5 text-14">
          <input type="checkbox" name="quitarLogo" className="h-4 w-4 accent-[var(--ga-admin-verde)]" />
          Quitar el logo actual
        </label>
      ) : null}
      <label className="flex items-center gap-2.5 text-14 font-bold">
        <input
          type="checkbox"
          name="visible"
          defaultChecked={v ? v.visible : (convenio?.visible ?? true)}
          className="h-4 w-4 accent-[var(--ga-admin-verde)]"
        />
        Visible en la landing y en /cuenta
      </label>
      {estado.errorGeneral ? (
        <p role="alert" className="m-0 text-14 font-semibold text-admin-rojo-2">
          {estado.errorGeneral}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <BotonGuardar nuevo={!convenio} />
        <button type="button" onClick={onCerrar} className={CLASE_BOTON_SECUNDARIO}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Botón de una acción de la fila (subir, bajar, ocultar/mostrar). */
function AccionFila({
  accion,
  id,
  campos,
  etiqueta,
  etiquetaCarga,
  deshabilitado,
  onResultado,
}: {
  accion: (previo: EstadoAccionConvenio, formData: FormData) => Promise<EstadoAccionConvenio>;
  id: string;
  campos: Record<string, string>;
  etiqueta: string;
  etiquetaCarga: string;
  deshabilitado?: boolean;
  onResultado: (estado: EstadoAccionConvenio) => void;
}) {
  const [estado, despachar, pendiente] = useActionState(accion, ACCION_VACIA);
  useEffect(() => {
    onResultado(estado);
  }, [estado, onResultado]);
  return (
    <form action={despachar}>
      <input type="hidden" name="id" value={id} />
      {Object.entries(campos).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      <button type="submit" disabled={pendiente || deshabilitado} aria-busy={pendiente || undefined} className={CLASE_BOTON_SECUNDARIO}>
        {pendiente ? etiquetaCarga : etiqueta}
      </button>
    </form>
  );
}

function BotonEliminar({ id, nombre, onResultado }: { id: string; nombre: string; onResultado: (e: EstadoAccionConvenio) => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const [estado, despachar, pendiente] = useActionState(eliminarConvenio, ACCION_VACIA);
  useEffect(() => {
    onResultado(estado);
  }, [estado, onResultado]);

  if (!confirmando) {
    return (
      <button type="button" onClick={() => setConfirmando(true)} className={CLASE_BOTON_SECUNDARIO + " text-admin-rojo-2"}>
        Eliminar
      </button>
    );
  }
  return (
    <form action={despachar} role="group" aria-label={`Confirmar eliminación de ${nombre}`} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-13 font-extrabold text-admin-rojo-2">¿Eliminar «{nombre}»? No se puede deshacer.</span>
      <button type="submit" disabled={pendiente} aria-busy={pendiente || undefined} className={CLASE_BOTON_SECUNDARIO + " text-admin-rojo-2 !shadow-[inset_0_0_0_1px_var(--ga-admin-rojo)]"}>
        {pendiente ? "Eliminando…" : "Sí, eliminar"}
      </button>
      <button type="button" onClick={() => setConfirmando(false)} disabled={pendiente} className={CLASE_BOTON_SECUNDARIO}>
        No
      </button>
    </form>
  );
}

/** Lista de convenios con crear, editar, ocultar/mostrar, ordenar y eliminar (5.9 / P-68). */
export function GestorConvenios({ convenios }: { convenios: ConvenioAdmin[] }) {
  // «nuevo» o el id del convenio que se edita; null = ningún formulario abierto.
  const [editando, setEditando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<EstadoAccionConvenio>({});
  const cerrar = useCallback(() => setEditando(null), []);
  const alResultado = useCallback((estado: EstadoAccionConvenio) => {
    if (estado.error || estado.mensaje) setAviso(estado);
  }, []);

  const abierto = editando === "nuevo" ? null : convenios.find((c) => c.id === editando);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-display text-30 font-extrabold tracking-titular lg:text-34">Convenios</h1>
        <button
          type="button"
          onClick={() => setEditando("nuevo")}
          className="flex h-12 items-center rounded-full bg-admin-verde px-7 text-15 font-extrabold text-admin-fondo"
        >
          Nuevo convenio
        </button>
      </div>

      {editando === "nuevo" ? <FormularioConvenio key="nuevo" onCerrar={cerrar} /> : null}
      {abierto ? <FormularioConvenio key={abierto.id} convenio={abierto} onCerrar={cerrar} /> : null}

      <p role="status" aria-live="polite" className={"m-0 text-14 font-bold " + (aviso.error ? "text-admin-rojo-2" : "text-admin-verde-2")}>
        {aviso.error ?? aviso.mensaje}
      </p>

      <section className="flex flex-col gap-2 rounded-20 bg-admin-superficie p-5.5">
        <h2 className="m-0 font-display text-20 font-extrabold">Empresas en convenio</h2>
        {convenios.length === 0 ? (
          <p className="m-0 text-15 text-admin-texto-3">Todavía no hay convenios. Crea el primero con «Nuevo convenio».</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {convenios.map((c, indice) => (
              <li key={c.id} className={"flex flex-col gap-3 rounded-14 bg-admin-superficie-2 p-3.5" + (c.visible ? "" : " opacity-85")}>
                <div className="flex items-start gap-3">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-10 bg-white p-0.5 object-contain" />
                  ) : (
                    <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center text-24">
                      {c.emoji || "🤝"}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-16 font-extrabold text-white">{c.nombreEmpresa}</span>
                    <span className="text-13 text-admin-texto-3">
                      {c.especialidad || "Sin especialidad"}
                      {c.nit ? ` · NIT ${c.nit}` : ""} · Orden {c.orden}
                    </span>
                    <span className={"text-13 font-extrabold " + (c.visible ? "text-admin-verde-2" : "text-admin-ambar")}>
                      {c.visible ? "Visible" : "Oculto"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setEditando(c.id)} className={CLASE_BOTON_SECUNDARIO}>
                    Editar
                  </button>
                  <AccionFila accion={moverConvenio} id={c.id} campos={{ direccion: "subir" }} etiqueta="Subir" etiquetaCarga="Subiendo…" deshabilitado={indice === 0} onResultado={alResultado} />
                  <AccionFila accion={moverConvenio} id={c.id} campos={{ direccion: "bajar" }} etiqueta="Bajar" etiquetaCarga="Bajando…" deshabilitado={indice === convenios.length - 1} onResultado={alResultado} />
                  <AccionFila
                    accion={alternarVisibilidadConvenio}
                    id={c.id}
                    campos={{ visible: String(!c.visible) }}
                    etiqueta={c.visible ? "Ocultar" : "Mostrar"}
                    etiquetaCarga="Guardando…"
                    onResultado={alResultado}
                  />
                  <BotonEliminar id={c.id} nombre={c.nombreEmpresa} onResultado={alResultado} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
