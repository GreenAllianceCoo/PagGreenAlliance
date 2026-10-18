"use client";

import { useActionState, useState } from "react";
import {
  cambiarPausaCuenta,
  crearAviso,
  desactivarAviso,
  type EstadoPlataforma,
} from "@/app/admin/plataforma/actions";
import type { AvisoAdmin, EstadoPausa } from "@/lib/admin/plataforma";
import { cx } from "@/components/ui/cx";
import { BotonAdmin, CampoAdmin, CLASE_CONTROL_ADMIN } from "./CamposAdmin";

const INICIAL: EstadoPlataforma = {};
const CLASE_AREA = cx(CLASE_CONTROL_ADMIN, "h-auto min-h-24 resize-y py-3 leading-140");

function Resultado({ estado }: { estado: EstadoPlataforma }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cx("m-0 text-14", estado.error ? "font-semibold text-admin-rojo-2" : "text-admin-verde-2")}
    >
      {estado.error ?? estado.mensaje}
    </p>
  );
}

/** «Pausar el ingreso de asociados»: cierra /cuenta a los asociados (admins, secretarios y asesores siguen entrando). */
export function PausaCuenta({ pausa }: { pausa: EstadoPausa }) {
  const [estado, accion] = useActionState(cambiarPausaCuenta, INICIAL);
  const [mensaje, setMensaje] = useState(pausa.mensaje ?? "");

  return (
    <section
      aria-labelledby="pausa-titulo"
      className={cx("flex flex-col gap-3.5 rounded-20 p-5.5", pausa.pausada ? "bg-admin-rojo-fondo" : "bg-admin-superficie")}
    >
      <h2 id="pausa-titulo" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Ingreso de asociados
      </h2>
      <p className="m-0 text-16 font-bold text-admin-texto">
        {pausa.pausada
          ? "En pausa: los asociados no pueden entrar a su cuenta."
          : "Abierto: los asociados entran con normalidad."}
      </p>
      <p className="m-0 text-14 leading-145 text-admin-texto-2">
        Úselo si algo falla y no hay nadie del equipo técnico disponible. Mientras esté en pausa, los asociados ven un aviso
        con el botón de WhatsApp. Los administradores, secretarios y asesores siguen entrando.
      </p>
      {pausa.ultimoCambio ? <p className="m-0 text-13 text-admin-texto-3">{pausa.ultimoCambio}</p> : null}
      <form action={accion} noValidate className="flex flex-col gap-3">
        <input type="hidden" name="pausada" value={String(!pausa.pausada)} />
        {!pausa.pausada ? (
          <CampoAdmin
            id="pausa-mensaje"
            label="Mensaje para los asociados (opcional)"
            ayuda="De 5 a 300 caracteres. Si lo deja vacío: «Estamos haciendo ajustes en la plataforma…»."
          >
            {(p) => (
              <textarea
                {...p}
                name="mensaje"
                rows={3}
                maxLength={300}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                className={CLASE_AREA}
              />
            )}
          </CampoAdmin>
        ) : null}
        <BotonAdmin variante={pausa.pausada ? "verde" : "rojo"} textoCargando="Guardando…" className="self-start">
          {pausa.pausada ? "Reanudar el ingreso" : "Pausar el ingreso de asociados"}
        </BotonAdmin>
        <Resultado estado={estado} />
      </form>
    </section>
  );
}

/** «Avisos para los asociados»: se muestran una vez, en una ventana, la próxima vez que cada asociado entra. */
export function AvisosAsociados({ avisos }: { avisos: AvisoAdmin[] }) {
  const [estado, accion] = useActionState(crearAviso, INICIAL);

  return (
    <section aria-labelledby="avisos-titulo" className="flex flex-col gap-3.5 rounded-20 bg-admin-superficie p-5.5">
      <h2 id="avisos-titulo" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Avisos para los asociados
      </h2>
      <p className="m-0 text-14 leading-145 text-admin-texto-2">
        Cada asociado verá el aviso en una ventana la próxima vez que entre a su cuenta, una sola vez. Los asociados que se
        registren después no lo ven. No se envía por correo.
      </p>
      {/* Campos no controlados: React vacía el formulario después de enviarlo; el navegador
          exige los largos mínimos antes (y el servidor y la base los vuelven a validar). */}
      <form action={accion} className="flex flex-col gap-3">
        <CampoAdmin id="aviso-titulo" label="Título" ayuda="De 3 a 80 caracteres.">
          {(p) => (
            <input
              {...p}
              name="titulo"
              required
              minLength={3}
              maxLength={80}
              className={CLASE_CONTROL_ADMIN}
            />
          )}
        </CampoAdmin>
        <CampoAdmin id="aviso-mensaje" label="Mensaje" ayuda="De 5 a 1000 caracteres.">
          {(p) => (
            <textarea
              {...p}
              name="mensaje"
              rows={4}
              required
              minLength={5}
              maxLength={1000}
              className={CLASE_AREA}
            />
          )}
        </CampoAdmin>
        <BotonAdmin textoCargando="Publicando…" className="self-start">
          Publicar aviso
        </BotonAdmin>
        <Resultado estado={estado} />
      </form>

      {avisos.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {avisos.map((a) => (
            <FilaAviso key={a.id} aviso={a} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-14 text-admin-texto-3">Todavía no hay avisos publicados.</p>
      )}
    </section>
  );
}

function FilaAviso({ aviso }: { aviso: AvisoAdmin }) {
  const [estado, accion] = useActionState(desactivarAviso, INICIAL);
  return (
    <li className="flex flex-col gap-1.5 rounded-14 p-3.5 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]">
      <span className="flex flex-wrap items-center gap-2">
        <strong className="text-15 text-admin-texto">{aviso.titulo}</strong>
        <span
          className={cx(
            "rounded-full px-2.5 py-0.5 text-12 font-bold",
            aviso.activo ? "bg-admin-verde-fondo text-admin-verde-2" : "bg-white/[.06] text-admin-texto-3",
          )}
        >
          {aviso.activo ? "Activo" : "Retirado"}
        </span>
      </span>
      <span className="whitespace-pre-line text-14 leading-140 text-admin-texto-2">{aviso.mensaje}</span>
      <span className="text-13 text-admin-texto-3">
        {aviso.autor ?? "Administrador"} · {aviso.creado} · Visto por {aviso.vistos}{" "}
        {aviso.vistos === 1 ? "asociado" : "asociados"}
      </span>
      {aviso.activo ? (
        <form action={accion} className="flex flex-col gap-1">
          <input type="hidden" name="avisoId" value={aviso.id} />
          <BotonAdmin variante="borde" textoCargando="Retirando…" className="self-start">
            Retirar
          </BotonAdmin>
          <Resultado estado={estado} />
        </form>
      ) : null}
    </li>
  );
}
