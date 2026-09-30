"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { cerrarSesion } from "@/app/cuenta/actions";
import { SECCIONES, type Seccion } from "./secciones";

type EncabezadoAdminProps = {
  nombre: string;
  /** Sección actual, para subrayarla (coincide con el primer tramo de la ruta). */
  seccion: Seccion;
};

/**
 * Encabezado propio de /admin en modo oscuro (piezas 2d/3e–3h): franja
 * superior oscura con el logo. En celular (siempre, incluida /admin/demo) es
 * una barra compacta + un menú «☰» con «Salir», y debajo una fila de
 * pestañas en píldora que se desplaza en horizontal (sin maqueta propia:
 * mismo patrón que un menú lateral que se desliza, según la nota de la
 * pieza 3h). En escritorio esta MISMA barra es la que usa /admin/demo (nav en
 * línea, sin píldoras ni menú lateral, pieza 3h); las otras 4 secciones
 * ocultan esta barra en `lg:` y usan en su lugar el menú lateral de
 * `AdminShell.tsx`.
 */
export function EncabezadoAdmin({ nombre, seccion }: EncabezadoAdminProps) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const idMenu = useId();

  // Esc cierra el menú del celular (mismo criterio que el modal del sorteo).
  useEffect(() => {
    if (!menuAbierto) return;
    function alTeclado(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuAbierto(false);
    }
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [menuAbierto]);

  return (
    // Hallazgo de contraste (axe, tras el hallazgo #0 del informe responsive
    // 2026-09-27): en escritorio este encabezado SOLO se ve completo en
    // /admin/demo (en las otras 4 secciones AdminShell lo envuelve en
    // `lg:hidden` y usa el menú lateral en su lugar); ahí el fondo de la
    // página es claro (simula /cuenta), así que `lg:bg-transparent` dejaba el
    // texto claro pensado para el fondo oscuro del admin (p. ej.
    // `text-admin-texto-3`) sobre un fondo claro, con muy poco contraste. Se
    // mantiene el mismo fondo oscuro que ya usa en celular en vez de
    // transparentarse: es justo el efecto que ya se ve bien ahí (barra
    // oscura flotando sobre el cuerpo claro de la demo).
    <header className="relative bg-admin-menu lg:border-b lg:border-admin-borde-sutil">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 lg:h-[70px] lg:px-8 lg:py-0">
        <Link
          href="/admin"
          aria-label="Ir al panel de administración"
          className="flex min-h-11 items-center gap-2 lg:min-h-0 lg:gap-2.5"
        >
          <Image
            src="/logos/blanco/green-alliance-isotipo-blanco.svg"
            alt=""
            width={30}
            height={30}
            className="h-[26px] w-[26px] shrink-0 lg:h-[30px] lg:w-[30px]"
          />
          <Image
            src="/logos/blanco/green-alliance-wordmark-blanco.svg"
            alt="Cooperativa Green Alliance"
            width={140}
            height={23}
            className="h-auto w-[104px] lg:w-[140px]"
          />
        </Link>

        {/* Nav en línea: solo en escritorio (usado por /admin/demo; en las otras
            4 secciones AdminShell oculta esta barra completa en `lg:`). */}
        <nav aria-label="Secciones del panel" className="hidden items-center gap-6 text-15 font-bold text-admin-texto-3 lg:flex">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              aria-current={seccion === s.clave ? "page" : undefined}
              className={
                s.clave === seccion
                  ? "border-b-2 border-admin-verde pb-1 text-admin-verde no-underline"
                  : "pb-1 text-admin-texto-3 no-underline hover:text-admin-texto"
              }
            >
              {s.etiqueta}
            </Link>
          ))}
        </nav>

        {/* Sin `text-admin-texto` explícito, este bloque heredaba el color de
            texto por defecto del sitio (--ga-texto, navy oscuro, pensado para
            fondos claros): invisible mientras el encabezado era transparente,
            pero muy poco contraste ahora que /admin/demo lo muestra sobre
            fondo oscuro de verdad (hallazgo de axe, ver nota de más arriba). */}
        <div className="hidden items-center gap-3 text-14 font-bold text-admin-texto lg:flex">
          <span className="max-w-[160px] truncate">{nombre}</span>
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="flex h-10 items-center rounded-10 px-4 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] hover:bg-admin-superficie"
            >
              Salir
            </button>
          </form>
        </div>

        {/* Menú «☰»: solo en celular. */}
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={menuAbierto}
          aria-controls={idMenu}
          onClick={() => setMenuAbierto((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-admin-superficie text-15 lg:hidden"
        >
          <span aria-hidden="true">☰</span>
          <span className="sr-only">Menú</span>
        </button>
      </div>

      {/* Pestañas en píldora: solo en celular, en todas las secciones (incluida /admin/demo). */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 text-13 font-bold whitespace-nowrap lg:hidden">
        {SECCIONES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-current={seccion === s.clave ? "page" : undefined}
            className={
              "inline-flex min-h-11 items-center rounded-full px-3.5 no-underline " +
              (s.clave === seccion ? "bg-admin-superficie-2 text-white" : "text-admin-texto-3")
            }
          >
            {s.etiqueta}
          </Link>
        ))}
      </div>

      {/* Menú deslizante del celular: sin maqueta propia (nota de la pieza 3h);
          panel simple con el nombre y «Salir». */}
      {menuAbierto ? (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
            className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          />
          <div
            id={idMenu}
            role="dialog"
            aria-modal="true"
            aria-label="Menú del panel"
            className="motion-safe:animate-ga-toast fixed right-3 top-16 z-30 flex w-56 flex-col gap-3 rounded-16 bg-admin-superficie p-4 shadow-modal-toast lg:hidden"
          >
            <span className="truncate text-15 font-bold">{nombre}</span>
            <span className="text-13 text-admin-texto-3">Administrador</span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="flex h-11 w-full items-center justify-center rounded-10 shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] font-bold hover:bg-admin-superficie-2"
              >
                Salir
              </button>
            </form>
          </div>
        </>
      ) : null}
    </header>
  );
}
