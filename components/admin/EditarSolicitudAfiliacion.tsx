"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { editarAfiliacion, type EstadoEditarAfiliacion } from "@/app/admin/afiliaciones/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { gradosDeInstitucion, gradoTrasCambiarInstitucion, type GradoCatalogo } from "@/lib/gradosCatalogo";
import { DOMINIOS_INSTITUCIONALES } from "@/lib/validaciones/dominiosInstitucionales";
import { esInstitucion, INSTITUCIONES, NOMBRE_INSTITUCION } from "@/lib/validaciones/instituciones";
import { CampoModal, CamposCuentaNomina, CLASE_CAMPO_MODAL, entidadInicial, type PropsControl } from "./CamposModal";

const INICIAL: EstadoEditarAfiliacion = {};

/** Lo que el solicitante escribió, tal como está guardado en solicitudes_afiliacion. */
export type DatosSolicitudEditable = {
  id: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  institucion: string;
  grado: string;
  celular: string | null;
  nequi: string | null;
  email: string | null;
  correoInstitucional: string | null;
  nominaEntidad: string | null;
  nominaTipo: string | null;
  nominaNumero: string | null;
};

type Valores = {
  nombres: string;
  apellidos: string;
  cedula: string;
  institucion: string;
  grado_id: string;
  celular: string;
  nequi: string;
  email: string;
  correo_institucional: string;
  nomina_entidad: string;
  nomina_entidad_otra: string;
  nomina_tipo: string;
  nomina_numero: string;
};

/**
 * «Editar datos de la solicitud» (pedido de Ricardo, 23-oct): solo el admin y
 * solo con la solicitud en Pendiente o Contactado. Corrige lo que escribió el
 * solicitante antes de aprobar, para que la cuenta se cree con los datos buenos.
 * Las fotos, el asesor y el mensaje no se tocan.
 */
export function EditarSolicitudAfiliacion({
  solicitud,
  grados,
  onGuardado,
}: {
  solicitud: DatosSolicitudEditable;
  grados: GradoCatalogo[];
  onGuardado: (mensaje: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setVuelta((v) => v + 1);
          setAbierto(true);
        }}
        className="flex h-11.5 items-center justify-center rounded-full px-6 text-14 font-extrabold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06]"
      >
        Editar datos de la solicitud
      </button>
      {abierto ? (
        <Formulario
          key={vuelta}
          solicitud={solicitud}
          grados={grados}
          onCerrar={() => setAbierto(false)}
          onGuardado={(mensaje) => {
            setAbierto(false);
            onGuardado(mensaje);
          }}
        />
      ) : null}
    </>
  );
}

function Formulario({
  solicitud,
  grados,
  onCerrar,
  onGuardado,
}: {
  solicitud: DatosSolicitudEditable;
  grados: GradoCatalogo[];
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [estado, accion, enviando] = useActionState(editarAfiliacion, INICIAL);
  const [valores, setValores] = useState<Valores>(() => {
    const entidad = entidadInicial(solicitud.nominaEntidad);
    return {
      nombres: solicitud.nombres,
      apellidos: solicitud.apellidos,
      cedula: solicitud.cedula,
      institucion: solicitud.institucion,
      grado_id: solicitud.grado,
      celular: solicitud.celular ?? "",
      nequi: solicitud.nequi ?? "",
      email: solicitud.email ?? "",
      correo_institucional: solicitud.correoInstitucional ?? "",
      nomina_entidad: entidad.entidad,
      nomina_entidad_otra: entidad.otra,
      nomina_tipo: solicitud.nominaTipo && solicitud.nominaTipo !== "deposito_electronico" ? solicitud.nominaTipo : "",
      nomina_numero: solicitud.nominaNumero ?? "",
    };
  });
  const control = (nombre: keyof Valores): PropsControl => ({
    name: nombre,
    value: valores[nombre],
    onChange: (e) => setValores((v) => ({ ...v, [nombre]: e.target.value })),
  });
  const formRef = useRef<HTMLFormElement>(null);
  const tituloId = `editar-solicitud-${solicitud.id}`;
  const errores = estado.errores ?? {};
  const institucion = esInstitucion(valores.institucion) ? valores.institucion : "";
  const opcionesGrado = gradosDeInstitucion(grados, institucion);
  const dominios = institucion ? DOMINIOS_INSTITUCIONALES[institucion].map((d) => `@${d}`).join(" o ") : null;

  useEffect(() => {
    if (estado.mensaje) onGuardado(estado.mensaje);
  }, [estado.mensaje, onGuardado]);

  // Foco al primer campo con error (o al aviso general).
  useEffect(() => {
    if (!estado.errores && !estado.error) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-general]')?.focus();
  }, [estado]);

  const texto = (nombre: keyof Valores, etiqueta: string, extra: Record<string, unknown> = {}, ayuda?: string) => (
    <CampoModal id={`${tituloId}-${nombre}`} etiqueta={etiqueta} ayuda={ayuda} error={errores[nombre as keyof typeof errores]}>
      {(p) => <input {...p} {...control(nombre)} autoComplete="off" className={CLASE_CAMPO_MODAL} {...extra} />}
    </CampoModal>
  );

  return (
    <Modal abierto={!estado.mensaje} onCerrar={onCerrar} tituloId={tituloId} variante="centrado">
      {/* onSubmit (sin `action`) para que React 19 no reinicie los <select> (mismo caso que F1 del 18-oct). */}
      <form
        ref={formRef}
        onSubmit={(evento: FormEvent<HTMLFormElement>) => {
          evento.preventDefault();
          const datos = new FormData(evento.currentTarget);
          startTransition(() => accion(datos));
        }}
        noValidate
        className="flex flex-col gap-4 text-ga-texto"
      >
        <input type="hidden" name="id" value={solicitud.id} />
        <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
          Editar datos de la solicitud
        </h2>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          Corrige lo que escribió la persona antes de aprobar: la cuenta se crea con estos datos. Las fotos, el asesor y el
          mensaje no se cambian. El cambio queda en el historial.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {texto("nombres", "Nombres", { maxLength: 60 })}
          {texto("apellidos", "Apellidos", { maxLength: 60 })}
        </div>
        {texto("cedula", "Cédula", { inputMode: "numeric", maxLength: 14 })}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CampoModal id={`${tituloId}-institucion`} etiqueta="Institución" error={errores.institucion}>
            {(p) => (
              <select
                {...p}
                name="institucion"
                value={valores.institucion}
                onChange={(e) => {
                  const nueva = e.target.value;
                  setValores((v) => ({
                    ...v,
                    institucion: nueva,
                    grado_id: gradoTrasCambiarInstitucion(grados, esInstitucion(nueva) ? nueva : "", v.grado_id),
                  }));
                }}
                className={CLASE_CAMPO_MODAL}
              >
                {INSTITUCIONES.map((i) => (
                  <option key={i} value={i}>
                    {NOMBRE_INSTITUCION[i]}
                  </option>
                ))}
              </select>
            )}
          </CampoModal>
          <CampoModal id={`${tituloId}-grado`} etiqueta="Grado" error={errores.grado_id}>
            {(p) => (
              <select {...p} {...control("grado_id")} className={CLASE_CAMPO_MODAL}>
                <option value="">Elige el grado</option>
                {opcionesGrado.map((g) => (
                  <option key={g.codigo} value={g.codigo}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            )}
          </CampoModal>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {texto("celular", "Celular", { type: "tel", inputMode: "numeric", maxLength: 16 })}
          {texto("nequi", "Nequi", { type: "tel", inputMode: "numeric", maxLength: 16 })}
        </div>
        {texto(
          "email",
          "Correo personal",
          { type: "email", maxLength: 254 },
          "Es el correo de ingreso: ahí le llega el código para entrar.",
        )}
        {texto(
          "correo_institucional",
          "Correo institucional",
          { type: "email", maxLength: 254 },
          dominios ? `Debe terminar en ${dominios}.` : undefined,
        )}

        <CamposCuentaNomina idBase={tituloId} control={control} errores={errores} opcionVacia="Elige la entidad" />

        {estado.error ? (
          <p role="alert" tabIndex={-1} data-error-general className="m-0 text-14 font-semibold text-ga-error">
            {estado.error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-11.5 items-center justify-center rounded-full px-6 text-15 font-bold text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-borde)]"
          >
            Cancelar
          </button>
          <Button type="submit" cargando={enviando} textoCargando="Guardando…">
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
