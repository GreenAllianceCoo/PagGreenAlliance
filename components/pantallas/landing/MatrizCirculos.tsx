"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Matriz de 8 círculos de color que se deslizan solos dentro de una grilla
 * 3×3 (como un rompecabezas de 8 piezas), imitando el `Matriz` interactivo
 * de docs/Green Alliance C+.dc.html (pieza 2a, hero de la landing).
 *
 * Es puramente decorativa (`aria-hidden`), no usa ninguna librería de
 * animación (solo `transform`, con transición CSS) y respeta
 * `prefers-reduced-motion`: si el usuario lo pide, o si `activo` es falso,
 * la grilla se queda quieta en su primer arreglo.
 */

// Colores de los 8 círculos, en el mismo orden que el diseño. El de índice 1
// lleva el isotipo en blanco (como en el original).
const COLORES = [
  "bg-ga-verde",
  "bg-ga-navy",
  "bg-ga-ambar",
  "bg-ga-menta",
  "bg-ga-verde-oscuro",
  "bg-ga-ambar-fondo-fuerte",
  "bg-white ring-inset ring-ga-verde",
  "bg-ga-navy-claro",
] as const;

const CON_LOGO = 1; // índice del círculo que muestra el isotipo blanco.
const CON_ANILLO = 6; // índice del círculo blanco con anillo verde.

type EstadoMatriz = {
  /** Posición (0–8) de cada uno de los 8 círculos, en el mismo orden que COLORES. */
  posiciones: number[];
  /** Casilla vacía (0–8). */
  hueco: number;
  /** Índice (dentro de `posiciones`) que se movió la última vez, para no repetirlo. */
  ultimo: number;
};

const ESTADO_INICIAL: EstadoMatriz = { posiciones: [0, 1, 2, 3, 4, 5, 6, 7], hueco: 8, ultimo: -1 };

function siguienteEstado(estado: EstadoMatriz): EstadoMatriz {
  const { hueco } = estado;
  const fila = Math.floor(hueco / 3);
  const columna = hueco % 3;
  const vecinos: number[] = [];
  if (fila > 0) vecinos.push(hueco - 3);
  if (fila < 2) vecinos.push(hueco + 3);
  if (columna > 0) vecinos.push(hueco - 1);
  if (columna < 2) vecinos.push(hueco + 1);
  const candidatos = vecinos.map((v) => estado.posiciones.indexOf(v)).filter((i) => i !== estado.ultimo);
  if (candidatos.length === 0) return estado;
  const i = candidatos[Math.floor(Math.random() * candidatos.length)];
  const posiciones = estado.posiciones.slice();
  const desde = posiciones[i];
  posiciones[i] = hueco;
  return { posiciones, hueco: desde, ultimo: i };
}

export type MatrizCirculosProps = {
  /** Tamaño de cada círculo, en px. */
  celda: number;
  /** Espacio entre círculos, en px. */
  espacio: number;
  /** Milisegundos entre cada movimiento. */
  velocidad?: number;
  className?: string;
};

export function MatrizCirculos({ celda, espacio, velocidad = 1300, className }: MatrizCirculosProps) {
  const [estado, setEstado] = useState(ESTADO_INICIAL);
  const reducido = useRef(false);

  useEffect(() => {
    reducido.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducido.current) return;
    const id = setInterval(() => setEstado((s) => siguienteEstado(s)), velocidad);
    return () => clearInterval(id);
  }, [velocidad]);

  const paso = celda + espacio;
  const tamano = celda * 3 + espacio * 2;
  const trasladar = (posicion: number) =>
    `translate(${(posicion % 3) * paso}px, ${Math.floor(posicion / 3) * paso}px)`;

  return (
    <div aria-hidden className={className} style={{ position: "relative", width: tamano, height: tamano }}>
      {/* Casillas de fondo: círculo punteado que marca las 9 posiciones. */}
      {Array.from({ length: 9 }, (_, p) => (
        <div
          key={`casilla-${p}`}
          className="absolute left-0 top-0 rounded-full border-2 border-dashed"
          style={{ width: celda, height: celda, transform: trasladar(p), borderColor: "rgba(26,60,87,.18)" }}
        />
      ))}
      {/* Los 8 círculos de color, cada uno en su posición actual. */}
      {estado.posiciones.map((posicion, i) => (
        <div
          key={`circulo-${i}`}
          className={`absolute left-0 top-0 flex items-center justify-center rounded-full shadow-md transition-transform duration-620 ease-spring motion-reduce:transition-none ${COLORES[i]} ${i === CON_ANILLO ? "ring-[3px]" : ""}`}
          style={{ width: celda, height: celda, transform: trasladar(posicion) }}
        >
          {i === CON_LOGO ? (
            <Image
              src="/logos/blanco/green-alliance-isotipo-blanco.svg"
              alt=""
              width={celda * 0.52}
              height={celda * 0.52}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
