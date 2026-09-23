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
        // Colores heredados del código anterior (/login, /dashboard). No borrar
        // mientras esas rutas existan.
        navy: "#1A3C57",
        green: "#1E6652",
        "surface-muted": "#F4F6F4",

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
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
      },
      // Tamaños de letra en px exactos del diseño: `text-15` = 15px.
      fontSize: {
        "10": "10px",
        "13": "13px",
        "14": "14px",
        "15": "15px",
        "16": "16px",
        "17": "17px",
        "18": "18px",
        "20": "20px",
        "21": "21px",
        "22": "22px",
        "24": "24px",
        "26": "26px",
        "28": "28px",
        "30": "30px",
        "32": "32px",
        "34": "34px",
        "36": "36px",
        "40": "40px",
        "46": "46px",
        "58": "58px",
      },
      lineHeight: {
        "105": "1.05",
        "108": "1.08",
        "110": "1.1",
        "115": "1.15",
        "125": "1.25",
        "130": "1.3",
        "145": "1.45",
        "150": "1.5",
        "155": "1.55",
      },
      letterSpacing: {
        titulo: "-0.02em",
        subtitulo: "-0.01em",
        cedula: "0.03em",
      },
      borderRadius: {
        "3": "3px",
        "10": "10px",
        "12": "12px", // inputs y botones
        "14": "14px",
        "16": "16px",
        "18": "18px",
        "20": "20px",
        "24": "24px",
      },
      borderWidth: {
        "1.5": "1.5px",
        "6": "6px",
      },
      spacing: {
        "4.5": "1.125rem", // 18px
        "5.5": "1.375rem", // 22px
        "13": "3.25rem", // 52px · alto de input
        "13.5": "3.375rem", // 54px · alto de botón
        "14.5": "3.625rem", // 58px · casilla OTP celular
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
        "tarjeta-enviada": "620px",
      },
      maxWidth: {
        "form-ingreso": "440px",
        "texto-convenios": "640px",
      },
      boxShadow: {
        tarjeta: "0 16px 40px var(--ga-sombra)",
      },
    },
  },
  plugins: [],
};
export default config;
