import type { Config } from "tailwindcss";

/**
 * Tokens de diseño de Green Alliance.
 * Los colores apuntan a las variables CSS definidas en app/globals.css
 * (fuente única de verdad). Valores sacados de design/*.dc.html.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ga: {
          verde: "var(--ga-verde)",
          "verde-oscuro": "var(--ga-verde-oscuro)",
          navy: "var(--ga-navy)",
          "navy-claro": "var(--ga-navy-claro)",
          "navy-texto-suave": "var(--ga-navy-texto-suave)",
          texto: "var(--ga-texto)",
          "texto-2": "var(--ga-texto-2)",
          "texto-3": "var(--ga-texto-3)",
          borde: "var(--ga-borde)",
          "borde-tarjeta": "var(--ga-borde-tarjeta)",
          linea: "var(--ga-linea)",
          "fondo-suave": "var(--ga-fondo-suave)",
          "verde-claro": "var(--ga-verde-claro)",
          "verde-tint": "var(--ga-verde-tint)",
          "verde-icono": "var(--ga-verde-icono)",
          ambar: "var(--ga-ambar)",
          "ambar-texto": "var(--ga-ambar-texto)",
          "ambar-fondo": "var(--ga-ambar-fondo)",
          "gris-paso": "var(--ga-gris-paso)",
          "gris-circulo": "var(--ga-gris-circulo)",
          "blanco-translucido": "var(--ga-blanco-translucido)",
          "marca-agua": "var(--ga-marca-agua)",
          error: "var(--ga-error)",

          // --- Rediseño C+ (25-sep-2026): tokens del design system `3a` de
          // docs/Green Alliance C+.dc.html (docs/diseno/lienzo-indice.md). ---
          superficie: "var(--ga-superficie)",
          "linea-suave": "var(--ga-linea-suave)",
          "borde-input": "var(--ga-borde-input)",
          "gris-azulado": "var(--ga-gris-azulado)",
          menta: "var(--ga-menta)",
          "menta-suave": "var(--ga-menta-suave)",
          "ambar-fondo-fuerte": "var(--ga-ambar-fondo-fuerte)",
          "ambar-fondo-suave": "var(--ga-ambar-fondo-suave)",
          "ambar-texto-2": "var(--ga-ambar-texto-2)",
          "error-fondo": "var(--ga-error-fondo)",
          "error-texto": "var(--ga-error-texto)",
          "deshabilitado-texto": "var(--ga-deshabilitado-texto)",

          // Extras de la landing (pieza 2a) sin nombre propio en `3a`.
          "verde-borde-pendiente": "var(--ga-verde-borde-pendiente)",
          "navy-chip-oscuro": "var(--ga-navy-chip-oscuro)",
          "blanco-chip": "var(--ga-blanco-chip)",
          "blob-oscuro": "var(--ga-blob-oscuro)",
          "blob-claro": "var(--ga-blob-claro)",

          // Panel de administración en modo oscuro (aún no se usa; queda listo para /admin, pedido D-05).
          "admin-fondo": "var(--ga-admin-fondo)",
          "admin-menu": "var(--ga-admin-menu)",
          "admin-superficie": "var(--ga-admin-superficie)",
          "admin-superficie-2": "var(--ga-admin-superficie-2)",
          "admin-texto": "var(--ga-admin-texto)",
          "admin-texto-2": "var(--ga-admin-texto-2)",
          "admin-texto-3": "var(--ga-admin-texto-3)",
          "admin-verde": "var(--ga-admin-verde)",
          "admin-verde-2": "var(--ga-admin-verde-2)",
          "admin-verde-claro": "var(--ga-admin-verde-claro)",
          "admin-ambar": "var(--ga-admin-ambar)",
          "admin-ambar-fondo": "var(--ga-admin-ambar-fondo)",
          "admin-rojo": "var(--ga-admin-rojo)",
          "admin-rojo-2": "var(--ga-admin-rojo-2)",
          "admin-rojo-claro": "var(--ga-admin-rojo-claro)",
          "admin-borde": "var(--ga-admin-borde)",
          "admin-borde-sutil": "var(--ga-admin-borde-sutil)",
          // Agregados por ga-diseno-a-codigo (tanda 4b): chips «aprobado»/«rechazado» del admin oscuro.
          "admin-verde-fondo": "var(--ga-admin-verde-fondo)",
          "admin-rojo-fondo": "var(--ga-admin-rojo-fondo)",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        // Bricolage Grotesque (600/800): títulos y cifras grandes. Rediseño C+.
        display: ["var(--font-bricolage)", "var(--font-manrope)", "system-ui", "sans-serif"],
      },
      // Tamaños de letra en px exactos del diseño: `text-15` = 15px.
      fontSize: {
        "10": "10px",
        // Agregado por ga-diseno-a-codigo (tanda 4b): chip de contador del menú del admin oscuro (pieza 2d).
        "12": "12px",
        "13": "13px",
        "14": "14px",
        "15": "15px",
        "16": "16px",
        "17": "17px",
        "18": "18px",
        "20": "20px",
        "21": "21px",
        "22": "22px",
        "23": "23px",
        "24": "24px",
        "26": "26px",
        "28": "28px",
        "30": "30px",
        "32": "32px",
        "34": "34px",
        "36": "36px",
        // Agregados por ga-diseno-a-codigo (tanda 4b, pieza 2d): cifras de las tarjetas KPI del admin oscuro.
        "38": "38px",
        "40": "40px",
        "48": "48px",
        "44": "44px",
        "46": "46px",
        "56": "56px",
        "58": "58px",
        "60": "60px",
        "64": "64px",
        "76": "76px",
        "80": "80px",
        "88": "88px",
      },
      lineHeight: {
        "90": ".9",
        "102": "1.02",
        "105": "1.05",
        "108": "1.08",
        "110": "1.1",
        "115": "1.15",
        "120": "1.2",
        "125": "1.25",
        "130": "1.3",
        // Agregado por ga-diseno-a-codigo (tanda 4b): textareas del admin oscuro (nota interna, motivo de rechazo).
        "140": "1.4",
        "145": "1.45",
        "150": "1.5",
        "155": "1.55",
      },
      letterSpacing: {
        titulo: "-0.02em",
        subtitulo: "-0.01em",
        cedula: "0.03em",
        // Rediseño C+: cifras y titulares en Bricolage Grotesque.
        hero: "-0.035em",
        titular: "-0.03em",
        cifra: "-0.04em",
        "cifra-grande": "-0.05em",
        etiqueta: "0.08em",
      },
      borderRadius: {
        "3": "3px",
        "6": "6px", // casilla del checkbox (pieza 3a)
        "10": "10px",
        "12": "12px", // inputs y botones
        "14": "14px",
        "16": "16px",
        "18": "18px",
        "20": "20px",
        "22": "22px",
        "24": "24px",
        "26": "26px",
        "28": "28px",
        "32": "32px",
        "36": "36px",
        "44": "44px",
      },
      borderWidth: {
        "1.5": "1.5px",
        "6": "6px",
      },
      // Curva «spring» del rediseño C+: transform/opacity únicamente (docs/Green Alliance C+.dc.html).
      transitionTimingFunction: {
        spring: "cubic-bezier(.34,1.3,.64,1)",
      },
      transitionDuration: {
        "320": "320ms",
        "400": "400ms",
        "500": "500ms",
        "620": "620ms",
      },
      keyframes: {
        // Titular y tarjetas que entran desde abajo con desvanecido.
        "ga-entrada": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Sello del comprobante: gira de −18° a −10° con rebote.
        "ga-sello": {
          from: { opacity: "0", transform: "rotate(-18deg) scale(.9)" },
          to: { opacity: "1", transform: "rotate(-10deg) scale(1)" },
        },
        // Código inválido (pieza 3b, MOVIMIENTO): 3 sacudidas de ±6 px, 40 ms cada una.
        "ga-sacude": {
          "0%, 100%": { transform: "translateX(0)" },
          "16.6%": { transform: "translateX(-6px)" },
          "33.3%": { transform: "translateX(6px)" },
          "50%": { transform: "translateX(-6px)" },
          "66.6%": { transform: "translateX(6px)" },
          "83.3%": { transform: "translateX(-6px)" },
        },
        // Check del comprobante «enviada»: se dibuja con un trazo (stroke-dashoffset).
        "ga-trazo": {
          from: { strokeDashoffset: "32" },
          to: { strokeDashoffset: "0" },
        },
        // Solo opacidad, sin mover nada alrededor: vista previa de foto elegida (pieza 3c).
        "ga-aparecer": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        // Agregados por ga-diseno-a-codigo (tanda 4b, pieza 2d «MOVIMIENTO»):
        // fila nueva de la lista de admin: entra desde arriba (−8px → 0).
        "ga-fila-entra": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // Toast del admin: sube 12px + fundido (se retira con un temporizador en JS, no con esta animación).
        "ga-toast": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // «Mis clientes» del asesor (pieza 2c, MOVIMIENTO): al filtrar, la lista
        // cambia con un fundido + 8 px en vez de saltar (imita una View Transition
        // sin usar esa API, que todavía no tiene soporte parejo en navegadores).
        "ga-lista": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "ga-entrada": "ga-entrada 400ms cubic-bezier(.34,1.3,.64,1) both",
        "ga-sello": "ga-sello 500ms cubic-bezier(.34,1.3,.64,1) both",
        "ga-sacude": "ga-sacude 240ms linear",
        "ga-trazo": "ga-trazo 400ms cubic-bezier(.34,1.3,.64,1) both",
        "ga-aparecer": "ga-aparecer 200ms ease-out both",
        "ga-fila-entra": "ga-fila-entra 320ms cubic-bezier(.34,1.3,.64,1) both",
        "ga-toast": "ga-toast 220ms ease-out both",
        "ga-lista": "ga-lista 200ms ease-out both",
      },
      spacing: {
        "4.5": "1.125rem", // 18px
        "5.5": "1.375rem", // 22px
        // Agregados por ga-diseno-a-codigo (tanda 4b, pieza 2d): alturas exactas de botones del admin oscuro.
        "11.5": "2.875rem", // 46px · botones del paso de confirmación
        "12.5": "3.125rem", // 50px · «Aprobar»/«Rechazar»
        "13": "3.25rem", // 52px · alto de input
        "13.5": "3.375rem", // 54px · alto de botón
        "14.5": "3.625rem", // 58px · casilla OTP escritorio (pieza 3b)
        "15": "3.75rem", // 60px
        "19": "4.75rem", // 76px · alto de header
        "22": "5.5rem", // 88px
        "55.5": "13.875rem", // 222px · panel verde celular sin barra de estado
        "62.5": "15.625rem", // 250px · panel verde celular (maqueta)
      },
      width: {
        logo: "240px",
        "panel-ingreso": "540px",
        "form-ingreso": "440px",
        "aside-afiliacion": "360px",
        "tarjeta-hero": "330px",
        // Pieza 3c (rediseño C+): antes 620px, ahora 520px, como el comprobante de «Solicitud enviada».
        "tarjeta-enviada": "520px",
      },
      maxWidth: {
        "form-ingreso": "440px",
        "texto-convenios": "640px",
      },
      boxShadow: {
        tarjeta: "0 16px 40px var(--ga-sombra)",
        // Rediseño C+: sombra de la píldora del encabezado y del comprobante flotante.
        pildora: "0 6px 24px -12px rgba(20,33,43,.2)",
        comprobante: "0 30px 60px -28px rgba(20,33,43,.45)",
        "comprobante-movil": "0 20px 40px -24px rgba(20,33,43,.4)",
        // Sombra de modal/toast del design system `3a` (aún no se usa en ninguna pantalla).
        "modal-toast": "0 8px 24px -12px rgba(20,33,43,.3)",
      },
    },
  },
  plugins: [],
};
export default config;
