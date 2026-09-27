"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AccionesAfiliacion } from "./AccionesAfiliacion";
import { ChipEstado, type EstadoAdmin } from "./ChipEstado";
import { FotoAfiliacion } from "./FotoAfiliacion";
import { ToastAdmin } from "./ToastAdmin";
import { enmascararCedula } from "@/lib/mascara";
import { formatearFecha } from "@/lib/cuenta";
import type { FilaListaAfiliacion } from "@/app/admin/afiliaciones/_datos";

const INSTITUCIONES: Record<string, string> = { policia: "Policía Nacional", ejercito: "Ejército Nacional" };

export type DetalleAfiliacion = {
  id: string;
  nombre: string;
  cedula: string;
  grado: string;
  institucion: string;
  celular: string | null;
  nequi: string | null;
  email: string | null;
  mensaje: string | null;
  asesorNombre: string | null;
  estado: string;
  created_at: string;
};

type Props = {
  solicitud: DetalleAfiliacion;
  fotos: { frente: string | null; reverso: string | null; selfie: string | null };
  /** Lista de hermanas del mismo estado (pieza 3e: «lista + ficha en la misma vista»), incluye la actual. */
  hermanas: FilaListaAfiliacion[];
};

/**
 * Detalle de una solicitud de afiliación (pieza 3e): lista de hermanas +
 * ficha con las 3 fotos, aprobar/rechazar en 2 pasos, nota interna (sin
 * backend todavía) e historial. J/K se mueven entre hermanas navegando a su
 * propia URL (cada una es una página de servidor distinta, a diferencia de
 * créditos que no cambia de ruta).
 */
export function PanelAfiliacionDetalle({ solicitud, fotos, hermanas }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [notaInterna, setNotaInterna] = useState("");

  useEffect(() => {
    function alTeclado(e: KeyboardEvent) {
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName ?? "");
      if (enCampo) return;
      const indice = hermanas.findIndex((h) => h.id === solicitud.id);
      if ((e.key === "j" || e.key === "J") && indice < hermanas.length - 1) {
        e.preventDefault();
        router.push(`/admin/afiliaciones/${hermanas[indice + 1].id}`);
      } else if ((e.key === "k" || e.key === "K") && indice > 0) {
        e.preventDefault();
        router.push(`/admin/afiliaciones/${hermanas[indice - 1].id}`);
      }
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [hermanas, solicitud.id, router]);

  return (
    <div className="grid grid-cols-1 items-start gap-4.5 lg:grid-cols-[minmax(0,1fr)_560px]">
      <section className="hidden overflow-hidden rounded-20 bg-admin-superficie lg:block">
        <div className="grid grid-cols-[2fr_1fr_1fr_.9fr] gap-2.5 border-b border-admin-borde-sutil px-4.5 py-3.5 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
          <span>Nombre</span>
          <span>Grado</span>
          <span>Enviada</span>
          <span>Estado</span>
        </div>
        {hermanas.map((h) => (
          <Link
            key={h.id}
            href={`/admin/afiliaciones/${h.id}`}
            className={
              "grid grid-cols-[2fr_1fr_1fr_.9fr] items-center gap-2.5 border-b border-admin-borde-sutil px-4.5 py-3.5 no-underline transition-colors duration-200 last:border-0 " +
              (h.id === solicitud.id ? "bg-admin-superficie-2" : "hover:bg-admin-superficie-2/60")
            }
          >
            <span className="flex flex-col gap-0.5 truncate">
              <span className="truncate text-15 font-extrabold text-white">{h.nombre}</span>
              <span className="text-13 tracking-cedula text-admin-texto-3">{enmascararCedula(h.cedula)}</span>
            </span>
            <span className="text-14 text-admin-texto-2">{h.grado}</span>
            <span className="text-14 text-admin-texto-2">{formatearFecha(h.created_at)}</span>
            <span className="justify-self-start">
              <ChipEstado estado={h.estado as EstadoAdmin} />
            </span>
          </Link>
        ))}
      </section>

      <section className="flex flex-col gap-4 rounded-20 bg-admin-superficie p-5.5">
        <div className="flex items-center justify-between">
          <ChipEstado estado={solicitud.estado as EstadoAdmin} tamano="md" />
          <span className="text-13 text-admin-texto-3">Enviada: {formatearFecha(solicitud.created_at)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-24 font-extrabold leading-115">{solicitud.nombre}</span>
          <span className="text-14 text-admin-texto-2">
            C.C. {solicitud.cedula} · {solicitud.grado} · {INSTITUCIONES[solicitud.institucion] ?? solicitud.institucion}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-14">
          <div className="rounded-12 bg-admin-superficie-2 px-3 py-2.5">
            <div className="text-admin-texto-3">Celular</div>
            <div className="font-bold">{solicitud.celular || "—"}</div>
          </div>
          <div className="rounded-12 bg-admin-superficie-2 px-3 py-2.5">
            <div className="text-admin-texto-3">Nequi</div>
            <div className="font-bold">{solicitud.nequi || "—"}</div>
          </div>
          <div className="col-span-2 min-w-0 rounded-12 bg-admin-superficie-2 px-3 py-2.5">
            <div className="text-admin-texto-3">Correo</div>
            <div className="truncate font-bold">{solicitud.email || "—"}</div>
          </div>
          <div className="col-span-2 rounded-12 bg-admin-superficie-2 px-3 py-2.5">
            <div className="text-admin-texto-3">Asesor que refirió</div>
            <div className="font-bold">{solicitud.asesorNombre ?? "Sin asesor"}</div>
          </div>
        </div>

        {solicitud.mensaje ? (
          <p className="m-0 whitespace-pre-wrap rounded-12 bg-admin-superficie-2 p-3 text-14 text-admin-texto-2">
            {solicitud.mensaje}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <span className="text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">
            Fotos · los enlaces vencen a los pocos minutos
          </span>
          <div className="grid grid-cols-3 gap-2.5">
            <FotoAfiliacion etiqueta="Cédula (frente)" url={fotos.frente} />
            <FotoAfiliacion etiqueta="Cédula (reverso)" url={fotos.reverso} />
            <FotoAfiliacion etiqueta="Selfie" url={fotos.selfie} />
          </div>
        </div>

        <div role="alert" className="flex flex-col gap-1 rounded-14 bg-admin-ambar-fondo p-3.5 text-14 leading-145">
          <strong className="text-admin-ambar">Antes de aprobar</strong>
          <span className="text-admin-texto-2">
            Confirma que el correo corresponde a la persona (puede ser personal, no solo institucional), y que la cédula y la
            selfie son de la misma persona. Si tienes dudas, contáctala por WhatsApp antes de aprobar.
          </span>
        </div>

        <AccionesAfiliacion id={solicitud.id} estado={solicitud.estado} nombre={solicitud.nombre} onResuelto={setToast} />

        {/* «Escribir por WhatsApp» (pieza 3e): decisión pendiente P-95 (¿con
            qué número — el que ya se ve arriba, o el institucional? ¿abre
            wa.me o un flujo propio?). Se deja visible pero deshabilitado en
            vez de inventar el comportamiento. */}
        <button
          type="button"
          disabled
          title="Pendiente de decidir (P-95): docs/diseno/pedidos.md"
          className="flex h-11 items-center justify-center gap-2 rounded-full text-14 font-bold text-admin-texto-3 shadow-[inset_0_0_0_1px_var(--ga-admin-borde-sutil)] disabled:cursor-not-allowed"
        >
          Escribir por WhatsApp
        </button>

        <div className="flex flex-col gap-2">
          <label htmlFor="nota-interna-afiliacion" className="text-14 font-bold">
            Nota interna <span className="font-medium text-admin-texto-3">· solo la ve el equipo</span>
          </label>
          <textarea
            id="nota-interna-afiliacion"
            rows={2}
            value={notaInterna}
            onChange={(e) => setNotaInterna(e.target.value)}
            placeholder="Ej.: Contestó por WhatsApp, confirmó su correo personal."
            // TODO(backend): igual que en créditos (pieza 2d), falta aplicar
            // supabase/migrations/20260925200200_historial_y_notas_internas.sql.
            className="resize-none rounded-12 bg-admin-fondo p-3 text-16 leading-140 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)]"
          />
          <p className="m-0 text-12 text-admin-texto-3">
            Por ahora no se guarda: falta conectar el historial (ver TODO(backend) en el código).
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3">Historial</span>
          <div className="flex gap-2.5 text-14 leading-140">
            <span aria-hidden="true" className="mt-1.5 h-2 w-2 flex-none rounded-full bg-admin-verde" />
            <span className="flex flex-col">
              <span className="font-bold text-admin-texto">Envió la afiliación</span>
              <span className="text-admin-texto-3">
                {solicitud.nombre} ·{" "}
                {new Date(solicitud.created_at).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Bogota",
                })}
              </span>
            </span>
          </div>
        </div>
      </section>

      <ToastAdmin mensaje={toast} onCerrar={() => setToast(null)} />
    </div>
  );
}
