"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui/cx";

/**
 * Tarjeta «Tu solicitud» del hero de la landing: un comprobante con sello que
 * avanza solo por sus 4 pasos, como pide la nota MOVIMIENTO de la pieza 2a
 * (docs/Green Alliance C+.dc.html). Es una ilustración (no hay datos reales
 * de ningún usuario): arranca en «En revisión» (paso 2 de 4), como el
 * prototipo del diseño, y cada 2,6 s avanza al siguiente paso.
 *
 * Con `prefers-reduced-motion: reduce` se queda fija en «2 de 4» (tal como
 * indica la tarjeta MOVIMIENTO), sin iniciar el intervalo.
 */

const PASOS = ["Enviada", "En revisión", "Aprobada", "Desembolso"] as const;
const MENSAJES = [
  "Recibimos tu solicitud.",
  "Te respondemos en poco tiempo.",
  "¡Aprobada! Te avisamos por correo.",
  "El desembolso va en camino.",
] as const;
const BADGE_TEXTO = ["Enviada", "En revisión", "Aprobada", "En desembolso"] as const;

type ClaveBadge = "sent" | "rev" | "ok";
const BADGE_ESTILO: Record<ClaveBadge, string> = {
  sent: "bg-ga-gris-azulado text-ga-navy",
  rev: "bg-ga-ambar-fondo text-ga-ambar-texto",
  ok: "bg-ga-verde-claro text-ga-verde-oscuro",
};

type ClaveMarcador = "done" | "sent" | "rev" | "pend";
const MARCADOR_ESTILO: Record<ClaveMarcador, string> = {
  done: "bg-ga-verde border-ga-verde text-white",
  sent: "bg-ga-navy border-ga-navy text-white",
  rev: "border-6 border-ga-ambar bg-ga-ambar-fondo text-ga-ambar-texto",
  pend: "border-2 border-ga-verde-borde-pendiente bg-white text-transparent",
};

function claveBadge(paso: number): ClaveBadge {
  return (["sent", "rev", "ok", "ok"] as const)[paso];
}

function claveMarcador(paso: number, i: number): ClaveMarcador {
  if (i < paso) return "done";
  if (i === paso) return i === 0 ? "sent" : i === 1 ? "rev" : "done";
  return "pend";
}

function usePasoComprobante() {
  const [paso, setPaso] = useState(1); // Arranca en «En revisión» (2 de 4), como el diseño.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setPaso((p) => (p + 1) % 4), 2600);
    return () => clearInterval(id);
  }, []);
  return paso;
}

type ComprobanteSolicitudProps = {
  /** `desktop`: tarjeta grande, título «Tu solicitud». `movil`: tarjeta compacta, «Así ves tu solicitud». */
  variante: "desktop" | "movil";
  className?: string;
};

export function ComprobanteSolicitud({ variante, className }: ComprobanteSolicitudProps) {
  const paso = usePasoComprobante();
  const esDesktop = variante === "desktop";

  return (
    <div
      className={cx(
        "relative flex flex-col rounded-26 bg-white lg:rounded-28",
        esDesktop ? "shadow-comprobante" : "shadow-comprobante-movil",
        className,
      )}
    >
      {/* Sello: isotipo dentro de un círculo punteado, ligeramente girado. */}
      <div
        className={cx(
          "absolute flex items-center justify-center rounded-full border-2 border-dashed border-ga-ambar bg-ga-ambar-fondo-suave motion-safe:animate-ga-sello motion-reduce:rotate-[-10deg]",
          esDesktop ? "-right-[26px] -top-[34px] h-[92px] w-[92px]" : "-top-6 right-3.5 h-[62px] w-[62px]",
        )}
      >
        <Image
          src="/logos/vector/green-alliance-isotipo.svg"
          alt=""
          width={esDesktop ? 46 : 30}
          height={esDesktop ? 46 : 30}
        />
      </div>

      <div className={cx("flex flex-col", esDesktop ? "gap-3.5 px-[26px] pb-4.5 pt-6" : "gap-3 px-5 pb-3.5 pt-5")}>
        <div className="flex items-center gap-2.5">
          <span className={cx("whitespace-nowrap font-display font-extrabold text-ga-navy", esDesktop ? "text-22" : "text-20")}>
            {esDesktop ? "Tu solicitud" : "Así ves tu solicitud"}
          </span>
          <span
            className={cx(
              "flex-none whitespace-nowrap rounded-full text-13 font-extrabold",
              esDesktop ? "px-3 py-1.5" : "px-2.5 py-[5px]",
              BADGE_ESTILO[claveBadge(paso)],
            )}
          >
            {BADGE_TEXTO[paso]}
          </span>
        </div>

        <div className="flex items-center gap-2 lg:items-baseline">
          <span className={cx("font-display font-extrabold leading-none tracking-cifra text-ga-navy", esDesktop ? "text-60" : "text-40")}>
            {paso + 1}
          </span>
          <span className="text-15 font-bold text-ga-texto-3">de 4{esDesktop ? " pasos" : ""}</span>
        </div>

        <div className="relative grid grid-cols-4">
          <div className="absolute left-[12.5%] right-[12.5%] top-4 h-[3px] rounded-full bg-ga-verde-claro" />
          <div
            className="absolute left-[12.5%] right-[12.5%] top-4 h-[3px] origin-left rounded-full bg-ga-verde transition-transform duration-500 ease-spring"
            style={{ transform: `scaleX(${paso / 3})` }}
          />
          {PASOS.map((etiqueta, i) => {
            const clave = claveMarcador(paso, i);
            return (
              <div
                key={etiqueta}
                className={cx(
                  "relative flex flex-col items-center gap-1.5 text-center leading-125",
                  esDesktop ? "text-14" : "text-13",
                  i === paso ? "font-extrabold text-ga-texto" : clave === "pend" ? "font-semibold text-ga-texto-3" : "font-semibold text-ga-texto",
                )}
              >
                <span
                  className={cx(
                    "box-border flex h-8 w-8 items-center justify-center rounded-full text-14 font-extrabold transition-colors duration-320",
                    MARCADOR_ESTILO[clave],
                  )}
                >
                  {clave === "done" || clave === "sent" ? "✓" : ""}
                </span>
                {etiqueta}
              </div>
            );
          })}
        </div>
      </div>

      <div className={cx("border-t-2 border-dashed border-ga-linea", esDesktop ? "mx-5.5" : "mx-4.5")} />

      <p className={cx("m-0 text-15 font-semibold text-ga-texto-2", esDesktop ? "px-[26px] py-4.5" : "px-5 py-3.5")}>
        {MENSAJES[paso]}
      </p>
    </div>
  );
}
