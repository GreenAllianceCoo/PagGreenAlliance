import type { CambioCorreoHistorial, FilaRecuperacion } from "@/lib/admin/recuperaciones";
import { CambiarCorreoIngreso } from "./CambiarCorreoIngreso";

/**
 * Sección «Correo de ingreso» de la ficha del asociado (recuperación de acceso):
 * acción «Cambiar correo de ingreso» (solo admin), la solicitud pendiente si la
 * hay y el historial de cambios (quién, cuándo y por qué; sin mostrar correos).
 */
export function CorreoIngresoAsociado({
  asociadoId,
  nombre,
  pendiente,
  historial,
  bloqueado = false,
}: {
  asociadoId: string;
  nombre: string;
  pendiente: FilaRecuperacion | null;
  historial: CambioCorreoHistorial[];
  /** RS-01: el admin es el asesor de este asociado (o es él mismo). */
  bloqueado?: boolean;
}) {
  return (
    <section aria-labelledby="correo-ingreso-titulo" className="flex flex-col gap-3 rounded-20 bg-admin-superficie p-5.5">
      <h2 id="correo-ingreso-titulo" className="m-0 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
        Correo de ingreso
      </h2>
      {pendiente ? (
        <p role="status" className="m-0 rounded-14 bg-admin-ambar-fondo p-3.5 text-14 leading-145 text-admin-ambar">
          <strong>Pidió recuperar el acceso</strong> el {pendiente.creada}. Correo nuevo: {pendiente.correoNuevo}. Celular{" "}
          {pendiente.celularCoincide ? "coincide" : "NO coincide"} con el de su perfil.
        </p>
      ) : null}
      {!pendiente && !bloqueado ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-texto-2">
          Solo se cambia el correo de ingreso cuando la persona pidió recuperar el acceso desde la pantalla de ingreso.
        </p>
      ) : null}
      {bloqueado ? (
        <p role="status" className="m-0 text-14 font-semibold text-admin-texto-2">
          Esta persona es tuya o de uno de tus clientes: otro administrador debe cambiarle el correo.
        </p>
      ) : null}
      <CambiarCorreoIngreso
        asociadoId={asociadoId}
        nombre={nombre}
        correoSugerido={pendiente?.correoNuevo}
        bloqueado={bloqueado || !pendiente}
        exigeConfirmarCelular={pendiente ? !pendiente.celularCoincide : false}
      />
      {historial.length > 0 ? (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
          {historial.map((h) => (
            <li key={h.id} className="flex gap-2.5 text-14 leading-140">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-none rounded-full bg-admin-verde" />
              <span className="flex flex-col">
                <span className="font-bold text-admin-texto">
                  {h.origen === "admin" ? "Cambió el correo de ingreso" : "Cambió su propio correo de ingreso"}
                </span>
                <span className="text-admin-texto-3">
                  {h.actor ?? "Administrador"} · {h.cuando} · {h.motivo}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
