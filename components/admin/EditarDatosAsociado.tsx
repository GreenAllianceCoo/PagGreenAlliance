"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { editarDatosAsociado, type EstadoEditarDatosAsociado } from "@/app/admin/asociados/actions";
import { Modal } from "@/components/ui/Modal";
import { NOMBRE_TIPO_CUENTA } from "@/lib/afiliacion/entidades";
import type { DatosEditablesAsociado } from "@/lib/admin/asociados";
import { DOMINIOS_INSTITUCIONALES } from "@/lib/validaciones/dominiosInstitucionales";
import { Button } from "@/components/ui/Button";
import { CampoModal, CamposCuentaNomina, CLASE_CAMPO_MODAL, entidadInicial } from "./CamposModal";

const INICIAL: EstadoEditarDatosAsociado = {};

type Props = {
  asociadoId: string;
  datos: DatosEditablesAsociado;
  /** RS-01: el admin es el asesor de este asociado (o es él mismo). */
  bloqueado?: boolean;
};

/**
 * Sección «Datos del asociado» de la ficha (solo admin): muestra nombre,
 * celular, correo institucional y cuenta de nómina, y «Editar datos» abre el
 * formulario. Cédula, grado, institución y asesor no se editan aquí.
 */
export function EditarDatosAsociado({ asociadoId, datos, bloqueado = false }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Cada apertura monta un formulario nuevo (estado y valores limpios).
  const [vuelta, setVuelta] = useState(0);

  const cuenta = datos.nominaEntidad
    ? [datos.nominaEntidad, datos.nominaTipo ? NOMBRE_TIPO_CUENTA[datos.nominaTipo] : null, datos.nominaNumero]
        .filter(Boolean)
        .join(" · ")
    : null;

  return (
    <section aria-labelledby="datos-asociado-titulo" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5.5">
      <h2 id="datos-asociado-titulo" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Datos del asociado
      </h2>
      <dl className="m-0 grid grid-cols-1 gap-x-4 gap-y-2.5 text-14 sm:grid-cols-[auto_1fr]">
        <Dato termino="Nombre">{datos.nombre}</Dato>
        <Dato termino="Celular">{datos.telefono ?? "Sin celular"}</Dato>
        <Dato termino="Correo institucional">{datos.correoInstitucional ?? "Sin correo institucional"}</Dato>
        <Dato termino="Cuenta de nómina">{cuenta ?? "Sin cuenta de nómina"}</Dato>
      </dl>
      {aviso ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-verde">
          {aviso}
        </p>
      ) : null}
      {bloqueado ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-texto-2">
          Esta persona es tuya o de uno de tus clientes: otro administrador debe editar sus datos.
        </p>
      ) : null}
      <button
        type="button"
        disabled={bloqueado}
        onClick={() => {
          setAviso(null);
          setVuelta((v) => v + 1);
          setAbierto(true);
        }}
        className="flex h-11.5 items-center justify-center self-start rounded-full px-6 text-14 font-extrabold text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-white/[.06] disabled:opacity-60"
      >
        Editar datos
      </button>
      {abierto ? (
        <FormularioDatos
          key={vuelta}
          asociadoId={asociadoId}
          datos={datos}
          onCerrar={() => setAbierto(false)}
          onGuardado={(mensaje) => {
            setAviso(mensaje);
            setAbierto(false);
          }}
        />
      ) : null}
    </section>
  );
}

function Dato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold text-admin-texto-3">{termino}</dt>
      <dd className="m-0 break-words text-admin-texto">{children}</dd>
    </>
  );
}

function FormularioDatos({
  asociadoId,
  datos,
  onCerrar,
  onGuardado,
}: {
  asociadoId: string;
  datos: DatosEditablesAsociado;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [estado, accion, enviando] = useActionState(editarDatosAsociado, INICIAL);
  // Campos controlados: React limpia los no controlados después de cada envío.
  const [valores, setValores] = useState(() => {
    const inicial = entidadInicial(datos.nominaEntidad);
    return {
      nombre: datos.nombre,
      telefono: datos.telefono ?? "",
      correoInstitucional: datos.correoInstitucional ?? "",
      nomina_entidad: inicial.entidad,
      nomina_entidad_otra: inicial.otra,
      nomina_tipo: datos.nominaTipo && datos.nominaTipo !== "deposito_electronico" ? datos.nominaTipo : "",
      nomina_numero: datos.nominaNumero ?? "",
    };
  });
  const campo = (nombre: keyof typeof valores) => ({
    name: nombre,
    value: valores[nombre],
    onChange: (e: { target: { value: string } }) => setValores((v) => ({ ...v, [nombre]: e.target.value })),
  });
  const formRef = useRef<HTMLFormElement>(null);
  const tituloId = `editar-datos-${asociadoId}`;
  const errores = estado.errores ?? {};

  useEffect(() => {
    if (estado.mensaje) onGuardado(estado.mensaje);
  }, [estado.mensaje, onGuardado]);

  // Foco al primer campo con error (o al aviso general).
  useEffect(() => {
    if (!estado.errores && !estado.error) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-error-general]')?.focus();
  }, [estado]);

  const dominios = datos.institucion ? DOMINIOS_INSTITUCIONALES[datos.institucion].map((d) => `@${d}`).join(" o ") : null;

  return (
    <Modal abierto={!estado.mensaje} onCerrar={onCerrar} tituloId={tituloId} variante="centrado">
      {/* Se envía con onSubmit (sin `action`): React 19 reinicia el <form> después de una Server
          Action y los <select> controlados se veían en «Sin cuenta» aunque el estado conservaba
          lo elegido (QA 18-oct, F1). Así el formulario no se reinicia. */}
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
        <input type="hidden" name="asociadoId" value={asociadoId} />
        <h2 id={tituloId} className="m-0 pr-12 font-display text-22 font-extrabold">
          Editar datos
        </h2>
        <p className="m-0 text-15 leading-150 text-ga-texto-2">
          La cédula, el grado, la institución y el asesor no se cambian aquí.
        </p>

        <CampoModal id={`${tituloId}-nombre`} etiqueta="Nombre completo" error={errores.nombre}>
          {(p) => <input {...p} {...campo("nombre")} maxLength={120} autoComplete="off" className={CLASE_CAMPO_MODAL} />}
        </CampoModal>
        <CampoModal id={`${tituloId}-telefono`} etiqueta="Celular" error={errores.telefono}>
          {(p) => (
            <input
              {...p}
              {...campo("telefono")}
              type="tel"
              inputMode="numeric"
              maxLength={16}
              autoComplete="off"
              className={CLASE_CAMPO_MODAL}
            />
          )}
        </CampoModal>
        <CampoModal
          id={`${tituloId}-correo`}
          etiqueta="Correo institucional"
          ayuda={dominios ? `Debe terminar en ${dominios}. Vacío = sin correo institucional.` : undefined}
          error={errores.correoInstitucional}
        >
          {(p) => (
            <input
              {...p}
              {...campo("correoInstitucional")}
              type="email"
              maxLength={254}
              autoComplete="off"
              className={CLASE_CAMPO_MODAL}
            />
          )}
        </CampoModal>

        <CamposCuentaNomina
          idBase={tituloId}
          control={campo}
          errores={errores}
          opcionVacia="Sin cuenta de nómina"
        />

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
