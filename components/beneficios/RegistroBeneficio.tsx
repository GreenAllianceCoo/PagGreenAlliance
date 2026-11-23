"use client";

import { useEffect, useRef } from "react";
import { registrarEventoBeneficio } from "@/app/cuenta/beneficios/actions";
import { IconoWhatsapp } from "@/components/ui/Iconos";

/** Registra la vista una sola vez al abrir el detalle. No dibuja nada. */
export function RegistrarVista({ id }: { id: string }) {
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current) return;
    hecho.current = true;
    void registrarEventoBeneficio(id, "vista");
  }, [id]);
  return null;
}

/** «Escribir por WhatsApp»: registra el clic y abre wa.me en otra pestaña. */
export function BotonWhatsappBeneficio({ id, href }: { id: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void registrarEventoBeneficio(id, "whatsapp")}
      className="flex h-12.5 items-center justify-center gap-2.5 rounded-full border-1.5 border-ga-navy bg-white px-6 text-15 font-semibold text-ga-navy no-underline transition-colors duration-200 hover:bg-ga-fondo-suave hover:text-ga-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
    >
      <IconoWhatsapp tamano={18} />
      Escribir por WhatsApp
    </a>
  );
}
