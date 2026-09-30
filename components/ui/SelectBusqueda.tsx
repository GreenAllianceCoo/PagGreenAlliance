"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type OpcionBusqueda = { valor: string; etiqueta: string; destacada?: boolean };

type SelectBusquedaProps = {
  id: string;
  /** Nombre del campo que viaja en el formulario (input oculto con el valor elegido). */
  name: string;
  opciones: OpcionBusqueda[];
  valor: string;
  onCambio: (valor: string) => void;
  /** Filtra las opciones con lo escrito (p. ej. `buscarEntidades`). Por defecto, «contiene» sin tildes. */
  filtrar?: (texto: string) => OpcionBusqueda[];
  placeholder?: string;
  /** Nombre accesible de la lista desplegable (por defecto «Opciones»). */
  etiquetaLista?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
};

function sinTildes(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Desplegable con búsqueda (patrón combobox de ARIA): se escribe para filtrar,
 * flechas para moverse, Enter elige, Escape cierra. Pieza 3j «Entidad bancaria».
 * El valor viaja en un <input type="hidden"> (no se reinicia al terminar la acción del formulario).
 */
export function SelectBusqueda({
  id,
  name,
  opciones,
  valor,
  onCambio,
  filtrar,
  placeholder = "Busca y elige",
  etiquetaLista = "Opciones",
  ...aria
}: SelectBusquedaProps) {
  const idLista = `${id}-lista`;
  const idBase = useId();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [activa, setActiva] = useState(0);
  const entradaRef = useRef<HTMLInputElement>(null);

  const visibles = useMemo(() => {
    if (!texto.trim()) return opciones;
    if (filtrar) return filtrar(texto);
    const q = sinTildes(texto.trim());
    return opciones.filter((o) => sinTildes(o.etiqueta).includes(q));
  }, [texto, opciones, filtrar]);

  const etiquetaElegida = opciones.find((o) => o.valor === valor)?.etiqueta ?? "";

  function abrir() {
    setAbierto(true);
    const indice = visibles.findIndex((o) => o.valor === valor);
    setActiva(indice >= 0 ? indice : 0);
  }

  function elegir(opcion: OpcionBusqueda) {
    onCambio(opcion.valor);
    setTexto("");
    setAbierto(false);
  }

  function alTeclear(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!abierto) abrir();
      else setActiva((i) => Math.min(i + 1, visibles.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiva((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault(); // no enviar el formulario
      if (visibles[activa]) elegir(visibles[activa]);
    } else if (e.key === "Escape" && abierto) {
      e.preventDefault();
      setAbierto(false);
      setTexto("");
    }
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={valor} />
      <input
        ref={entradaRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && visibles[activa] ? `${idBase}-${activa}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={abierto ? texto : etiquetaElegida}
        onChange={(e) => {
          setTexto(e.target.value);
          setActiva(0);
          if (!abierto) setAbierto(true);
        }}
        onFocus={abrir}
        onClick={() => !abierto && abrir()}
        onBlur={() => {
          setAbierto(false);
          setTexto("");
        }}
        onKeyDown={alTeclear}
        className={cx(
          "h-13 w-full min-w-0 rounded-12 border-1.5 border-ga-borde-input bg-white pl-3.5 pr-9 text-17 text-ga-texto",
          "transition-[border-color,box-shadow] duration-150 placeholder:text-ga-texto-3",
          "focus:border-ga-verde focus:outline-none focus:shadow-[0_0_0_3px_rgba(30,102,82,0.15)]",
          "aria-[invalid=true]:border-ga-error",
        )}
        {...aria}
      />
      <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ga-texto-3">
        ▾
      </span>
      {abierto ? (
        <ul
          id={idLista}
          role="listbox"
          aria-label={etiquetaLista}
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-64 overflow-auto rounded-12 bg-white py-1 shadow-modal-toast ring-1 ring-ga-linea"
        >
          {visibles.map((o, i) => (
            <li
              key={o.valor}
              id={`${idBase}-${i}`}
              role="option"
              aria-selected={o.valor === valor}
              // onMouseDown (no onClick): se ejecuta antes del blur del input, que cerraría la lista.
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(o);
              }}
              onMouseEnter={() => setActiva(i)}
              className={cx(
                "cursor-pointer px-3.5 py-2.5 text-15",
                o.destacada && "bg-ga-fondo-suave font-bold text-ga-verde",
                i === activa ? "bg-ga-verde-claro font-bold text-ga-verde-oscuro" : undefined,
              )}
            >
              {o.etiqueta}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
