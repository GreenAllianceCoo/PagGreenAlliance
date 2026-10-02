"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { CLASES_FORM_INGRESO, PanelIngreso, PieIngresoMovil } from "@/components/ingreso/PanelIngreso";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import { CAMPOS_RECUPERACION, esquemaRecuperacion, type CampoRecuperacion } from "@/lib/validaciones/recuperacion";
import { solicitarRecuperacion, type EstadoRecuperacion } from "./actions";

const INICIAL: EstadoRecuperacion = {};

/** Conecta /ingresar/recuperar con su Server Action (carga, errores por campo y foco). */
export function FormularioRecuperacion({ whatsapp, whatsappUrl }: { whatsapp: string; whatsappUrl: string | null }) {
  const [estado, accion, enviando] = useActionState(
    async (previo: EstadoRecuperacion, formData: FormData): Promise<EstadoRecuperacion> => {
      // Mismo esquema zod que el servidor: no viaja con un formato inválido.
      const valores = {
        cedula: String(formData.get("cedula") ?? ""),
        correo: String(formData.get("correo") ?? ""),
        celular: String(formData.get("celular") ?? ""),
        motivo: String(formData.get("motivo") ?? ""),
      };
      const local = esquemaRecuperacion.safeParse(valores);
      if (!local.success) return { errores: erroresPorCampo<CampoRecuperacion>(local.error), valores };
      return solicitarRecuperacion(previo, formData);
    },
    INICIAL,
  );

  // Foco al primer campo con error después de cada envío fallido.
  useEffect(() => {
    if (!estado.errores) return;
    const primero = CAMPOS_RECUPERACION.find((c) => estado.errores?.[c]);
    if (primero) document.getElementById(primero)?.focus();
  }, [estado]);

  const numero = whatsappUrl ? (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="underline">
      {whatsapp}
    </a>
  ) : (
    whatsapp
  );
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};

  return (
    <PanelIngreso
      titulo="Recupera tu acceso"
      subtitulo="Cuéntanos a qué correo quieres recibir tus códigos y la cooperativa te contactará para verificar que eres tú."
      pie={<>Ayuda por WhatsApp {numero}</>}
      pieInterlineado={false}
      sinBarraEstado
      volverHref="/ingresar"
    >
      {estado.mensaje ? (
        <div className={CLASES_FORM_INGRESO}>
          <h2 className="m-0 font-display text-26 font-extrabold text-ga-navy lg:text-32">Solicitud recibida</h2>
          <p role="status" className="m-0 text-16 leading-150 text-ga-texto-2">
            {estado.mensaje}
          </p>
          <ButtonLink href="/ingresar" variante="secundario">
            Volver a ingresar
          </ButtonLink>
          <PieIngresoMovil interlineado={false}>Ayuda por WhatsApp {numero}</PieIngresoMovil>
        </div>
      ) : (
        <form action={accion} className={CLASES_FORM_INGRESO} noValidate>
          <h2 className="m-0 hidden font-display text-32 font-extrabold text-ga-navy lg:block">
            ¿Ya no tienes acceso a tu correo?
          </h2>
          <Field id="cedula" label="Número de cédula" tamano="lg" error={e.cedula}>
            {(control) => (
              <Input
                {...control}
                name="cedula"
                tamano="lg"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Sin puntos ni espacios"
                defaultValue={v.cedula}
              />
            )}
          </Field>
          <Field
            id="correo"
            label="Correo nuevo"
            tamano="lg"
            error={e.correo}
            ayuda="Uno al que tengas acceso hoy. Aquí recibirás tus códigos cuando la cooperativa lo apruebe."
          >
            {(control) => (
              <Input
                {...control}
                name="correo"
                tamano="lg"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nombre@correo.com"
                defaultValue={v.correo}
              />
            )}
          </Field>
          <Field id="celular" label="Celular (WhatsApp)" tamano="lg" error={e.celular}>
            {(control) => (
              <Input
                {...control}
                name="celular"
                tamano="lg"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="3001234567"
                defaultValue={v.celular}
              />
            )}
          </Field>
          <Field id="motivo" label="¿Qué pasó?" tamano="lg" error={e.motivo} ayuda="Máximo 300 caracteres.">
            {(control) => (
              <Textarea
                {...control}
                name="motivo"
                rows={3}
                maxLength={300}
                placeholder="Por ejemplo: perdí el acceso a mi correo anterior"
                defaultValue={v.motivo}
              />
            )}
          </Field>

          {/* Campo trampa (honeypot): fuera de pantalla, sin foco ni lector de pantalla. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="rec-sitio">No llenar este campo</label>
            <input id="rec-sitio" name="sitio_web" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          {estado.errorGeneral ? (
            <p role="alert" className="m-0 text-13 font-semibold text-ga-error">
              {estado.errorGeneral}
            </p>
          ) : null}
          <p className="m-0 text-14 leading-150 text-ga-texto-3">
            Esto no cambia nada por sí solo: la cooperativa te contactará para verificar tu identidad antes de
            cambiar tu correo.
          </p>
          <Button cargando={enviando} textoCargando="Enviando…">
            Enviar solicitud
          </Button>
          <Link href="/ingresar" className="enlace self-center text-15 font-bold">
            Volver a ingresar
          </Link>
          <PieIngresoMovil interlineado={false}>Ayuda por WhatsApp {numero}</PieIngresoMovil>
        </form>
      )}
    </PanelIngreso>
  );
}
