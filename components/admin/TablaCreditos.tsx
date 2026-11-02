"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { guardarCambiosTablaCreditos, type ResultadoCambioTabla } from "@/app/admin/creditos/tabla-actions";
import { ChipEstado } from "./ChipEstado";
import type { EstadoCredito, FilaCreditoPanel } from "./PanelCreditos";
import { coincideBusqueda } from "@/lib/admin/busqueda";
import { situacionTope } from "@/lib/admin/topeCredito";
import { formatearFecha, formatearPesos } from "@/lib/cuenta";
import { normalizarCedula, normalizarCelular, esquemaCedula } from "@/lib/validaciones/comunes";
import {
  esquemaNombreAsociado,
  esquemaTelefonoAsociado,
  MAX_CAMBIOS_TABLA_CREDITOS,
  type EntradaCambiosTablaCreditos,
} from "@/lib/validaciones/admin";
import type { CodigoGrado, PaqueteDemo } from "@/lib/asesor/datosDemo";
import { cx } from "@/components/ui/cx";

type CampoPersona = "nombre" | "cedula" | "telefono";
type EdicionPersona = Partial<Record<CampoPersona, string>>;
type Decision = "aprobado" | "rechazado";

type Columna =
  | "nombre"
  | "cedula"
  | "telefono"
  | "grado"
  | "recibe"
  | "devuelve"
  | "plazo"
  | "porcentaje"
  | "tipo"
  | "solicitud"
  | "estado"
  | "desembolso";

const ETIQUETA_COLUMNA: Record<Columna, string> = {
  nombre: "Asociado",
  cedula: "Cédula",
  telefono: "Celular",
  grado: "Grado",
  recibe: "Recibe",
  devuelve: "Devuelve en total",
  plazo: "Plazo",
  porcentaje: "Porcentaje",
  tipo: "Tipo",
  solicitud: "Solicitud",
  estado: "Estado",
  desembolso: "Desembolso",
};

const textoTipo = (f: FilaCreditoPanel) =>
  f.tipo_credito === "convenio" ? `Convenio${f.convenio_nombre ? ` · ${f.convenio_nombre}` : ""}` : "Cooperativa";

/** Valor con el que se ordena cada columna (siempre el guardado, no el que se está escribiendo: las filas no saltan). */
function valorOrden(f: FilaCreditoPanel, c: Columna): string | number {
  switch (c) {
    case "nombre":
      return f.nombre;
    case "cedula":
      return f.cedula;
    case "telefono":
      return f.telefono ?? "";
    case "grado":
      return f.grado;
    case "recibe":
      return f.monto_solicitado;
    case "devuelve":
      return f.total_a_pagar ?? -1;
    case "plazo":
      return f.plazo_meses;
    case "porcentaje":
      return f.porcentaje_credito;
    case "tipo":
      return textoTipo(f);
    case "solicitud":
      return f.fecha_solicitud;
    case "estado":
      return f.estado;
    case "desembolso":
      return f.fecha_desembolso ?? "";
  }
}

/** Valor guardado de un dato de la persona, en la forma en que se compara con lo escrito. */
function originalPersona(f: FilaCreditoPanel, campo: CampoPersona) {
  return campo === "nombre" ? f.nombre : campo === "cedula" ? f.cedula : (f.telefono ?? "");
}

/** ¿Lo escrito es igual a lo guardado? (sin contar espacios, puntos ni el +57). */
function igualAlOriginal(campo: CampoPersona, escrito: string, original: string) {
  if (campo === "nombre") return escrito.trim().replace(/\s+/g, " ") === original;
  if (campo === "cedula") return normalizarCedula(escrito) === original;
  return (escrito.trim() === "" ? "" : normalizarCelular(escrito)) === original;
}

/** Mismas reglas de «Editar datos» y «Corregir cédula» (el servidor las repite). */
function errorDeCelda(campo: CampoPersona, valor: string): string | undefined {
  const esquema = campo === "nombre" ? esquemaNombreAsociado : campo === "cedula" ? esquemaCedula : esquemaTelefonoAsociado;
  const r = esquema.safeParse(valor);
  return r.success ? undefined : r.error.issues[0]?.message;
}

const CLASE_CELDA = "border-b border-admin-borde-sutil px-3 py-2.5 align-middle";
const CLASE_CONTROL =
  "h-10 w-full min-w-0 rounded-12 bg-admin-fondo px-3 text-15 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ga-admin-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]";
/** Celda con un cambio sin guardar: fondo ámbar (mismo tono del chip «Pendiente»). */
const CLASE_CAMBIADA = "bg-admin-ambar-fondo shadow-[inset_0_0_0_1.5px_var(--ga-admin-ambar)]";

type Props = {
  /** Todas las filas de la pestaña (la búsqueda solo oculta; los cambios de las ocultas se conservan). */
  filas: FilaCreditoPanel[];
  busqueda: string;
  estadoFiltro: EstadoCredito;
  paquetesPorGrado: Partial<Record<CodigoGrado, PaqueteDemo[]>>;
  /** Secretario: la ve sin celdas editables y sin «Devuelve en total» (revela la tasa). */
  soloLectura: boolean;
  /** Para que el panel avise antes de cambiar de pestaña o de vista con cambios sin guardar. */
  onCambiosSinGuardar: (cantidad: number) => void;
  onAviso: (mensaje: string) => void;
};

/**
 * Vista de tabla de /admin/creditos (pedido del dueño, 2-nov): todas las columnas,
 * búsqueda y orden por columna. El admin corrige nombre, cédula y celular de la
 * persona y aprueba o rechaza las pendientes; «Guardar cambios» pide UN motivo para
 * todos (guardarCambiosTablaCreditos, que aplica cada uno por su camino de siempre).
 * Condiciones y desembolso se ven aquí pero se cambian en la ficha (vista «Lista»).
 */
export function TablaCreditos({ filas, busqueda, estadoFiltro, paquetesPorGrado, soloLectura, onCambiosSinGuardar, onAviso }: Props) {
  const [ediciones, setEdiciones] = useState<Record<string, EdicionPersona>>({});
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [erroresServidor, setErroresServidor] = useState<Record<string, string>>({});
  const [orden, setOrden] = useState<{ columna: Columna; asc: boolean } | null>(null);
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  // Primera fila de cada persona: de ahí salen sus datos guardados (son los mismos en todas sus filas).
  const filaDePersona = useMemo(() => {
    const mapa = new Map<string, FilaCreditoPanel>();
    for (const f of filas) if (!mapa.has(f.asociado_id)) mapa.set(f.asociado_id, f);
    return mapa;
  }, [filas]);

  // Solo cuentan los cambios de filas que siguen en la pestaña (tras guardar, las resueltas salen de «Pendiente»).
  const edicionesVigentes = Object.entries(ediciones).filter(([id, e]) => filaDePersona.has(id) && Object.keys(e).length > 0);
  const decisionesVigentes = Object.entries(decisiones).filter(([id]) => filas.some((f) => f.id === id && f.estado === "pendiente"));
  const totalCambios = edicionesVigentes.reduce((s, [, e]) => s + Object.keys(e).length, 0) + decisionesVigentes.length;
  const hayCeldaInvalida = edicionesVigentes.some(([, e]) =>
    (Object.entries(e) as [CampoPersona, string][]).some(([campo, valor]) => errorDeCelda(campo, valor)),
  );
  const rechazos = decisionesVigentes.filter(([, d]) => d === "rechazado").length;
  const cambiosCedula = edicionesVigentes.filter(([, e]) => e.cedula !== undefined).length;

  // El panel necesita saber cuántos cambios hay para avisar al salir; al desmontar, ninguno.
  useEffect(() => {
    onCambiosSinGuardar(totalCambios);
  }, [totalCambios, onCambiosSinGuardar]);
  useEffect(() => () => onCambiosSinGuardar(0), [onCambiosSinGuardar]);

  // Cerrar o recargar la pestaña con cambios sin guardar: el navegador pregunta.
  useEffect(() => {
    if (totalCambios === 0) return;
    function antesDeSalir(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", antesDeSalir);
    return () => window.removeEventListener("beforeunload", antesDeSalir);
  }, [totalCambios]);

  const visibles = useMemo(() => {
    const lista = filas.filter((f) => coincideBusqueda(busqueda, f.nombre, f.cedula));
    if (!orden) return lista;
    const signo = orden.asc ? 1 : -1;
    return [...lista].sort((a, b) => {
      const va = valorOrden(a, orden.columna);
      const vb = valorOrden(b, orden.columna);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "es");
      return r * signo;
    });
  }, [filas, busqueda, orden]);

  const columnas: Columna[] = (
    ["nombre", "cedula", "telefono", "grado", "recibe", "devuelve", "plazo", "porcentaje", "tipo", "solicitud", "estado", "desembolso"] as const
  ).filter((c) => !(soloLectura && c === "devuelve"));

  function editarPersona(f: FilaCreditoPanel, campo: CampoPersona, valor: string) {
    setEdiciones((previas) => {
      const actual = { ...(previas[f.asociado_id] ?? {}) };
      if (igualAlOriginal(campo, valor, originalPersona(filaDePersona.get(f.asociado_id) ?? f, campo))) delete actual[campo];
      else actual[campo] = valor;
      return { ...previas, [f.asociado_id]: actual };
    });
  }

  function decidir(f: FilaCreditoPanel, valor: string) {
    setDecisiones((previas) => {
      const siguientes = { ...previas };
      if (valor === "aprobado" || valor === "rechazado") siguientes[f.id] = valor;
      else delete siguientes[f.id];
      return siguientes;
    });
  }

  function descartar() {
    setEdiciones({});
    setDecisiones({});
    setErroresServidor({});
    setPidiendoMotivo(false);
    setMotivo("");
    setErrorMotivo(null);
    setErrorGeneral(null);
  }

  function guardar() {
    const motivoLimpio = motivo.trim().replace(/\s+/g, " ");
    if (motivoLimpio.length < 5 || motivoLimpio.length > 300) {
      setErrorMotivo("El motivo debe tener entre 5 y 300 caracteres.");
      return;
    }
    const entrada: EntradaCambiosTablaCreditos = {
      motivo: motivoLimpio,
      personas: edicionesVigentes.map(([asociadoId, e]) => ({ asociadoId, ...e })),
      estados: decisionesVigentes.map(([solicitudId, decision]) => ({ solicitudId, decision })),
    };
    setErrorMotivo(null);
    setErrorGeneral(null);
    iniciarEnvio(async () => {
      const r = await guardarCambiosTablaCreditos(entrada);
      if (r.errorMotivo) {
        setErrorMotivo(r.errorMotivo);
        return;
      }
      if (r.error || !r.resultados) {
        setErrorGeneral(r.error ?? "No pudimos guardar los cambios. Intenta de nuevo.");
        return;
      }
      aplicarResultados(r.resultados);
      if (r.resultados.every((x) => x.ok)) {
        setPidiendoMotivo(false);
        setMotivo("");
      }
      if (r.mensaje) onAviso(r.mensaje);
    });
  }

  /** Lo que salió bien se limpia; lo que falló conserva su cambio y queda marcado con su error. */
  function aplicarResultados(resultados: ResultadoCambioTabla[]) {
    const ok = resultados.filter((x) => x.ok).map((x) => x.clave);
    setEdiciones((previas) => {
      const siguientes: Record<string, EdicionPersona> = {};
      for (const [id, e] of Object.entries(previas)) {
        const resto = { ...e };
        if (ok.includes(`datos:${id}`)) {
          delete resto.nombre;
          delete resto.telefono;
        }
        if (ok.includes(`cedula:${id}`)) delete resto.cedula;
        if (Object.keys(resto).length > 0) siguientes[id] = resto;
      }
      return siguientes;
    });
    setDecisiones((previas) =>
      Object.fromEntries(Object.entries(previas).filter(([id]) => !ok.includes(`estado:${id}`))),
    );
    setErroresServidor(Object.fromEntries(resultados.filter((x) => !x.ok).map((x) => [x.clave, x.error ?? "No se guardó."])));
  }

  function alternarOrden(columna: Columna) {
    setOrden((previo) => (previo?.columna === columna ? { columna, asc: !previo.asc } : { columna, asc: true }));
  }

  return (
    <section aria-label="Créditos en tabla" className="flex min-w-0 flex-col gap-3">
      {soloLectura ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-16 bg-admin-superficie px-4.5 py-3">
          <p role="status" aria-live="polite" className="m-0 text-14 font-bold text-admin-texto-2">
            {totalCambios === 0 ? (
              estadoFiltro === "pendiente" ? (
                "Escribe en una celda para corregir nombre, cédula o celular, o elige Aprobar / Rechazar en el estado."
              ) : (
                "Escribe en una celda para corregir nombre, cédula o celular."
              )
            ) : (
              <span className="text-admin-ambar">
                {totalCambios} {totalCambios === 1 ? "cambio sin guardar" : "cambios sin guardar"}
              </span>
            )}
          </p>
          {totalCambios > 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={descartar}
                disabled={enviando}
                className="flex h-10 items-center rounded-full px-4.5 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] disabled:opacity-60"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={() => setPidiendoMotivo(true)}
                disabled={enviando || hayCeldaInvalida || totalCambios > MAX_CAMBIOS_TABLA_CREDITOS}
                title={hayCeldaInvalida ? "Corrige las celdas marcadas en rojo" : undefined}
                className="flex h-10 items-center rounded-full bg-admin-verde px-4.5 text-14 font-extrabold text-admin-fondo disabled:cursor-not-allowed disabled:opacity-40"
              >
                Guardar cambios
              </button>
            </div>
          ) : null}
          {totalCambios > MAX_CAMBIOS_TABLA_CREDITOS ? (
            <p className="m-0 w-full text-13 font-semibold text-admin-rojo-2">
              Puedes guardar máximo {MAX_CAMBIOS_TABLA_CREDITOS} cambios a la vez: descarta algunos o guárdalos en partes.
            </p>
          ) : null}
        </div>
      )}

      {!soloLectura && pidiendoMotivo && totalCambios > 0 ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          noValidate
          className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4 shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] motion-safe:animate-ga-aparecer"
        >
          <label htmlFor="motivo-tabla" className="text-14 font-bold">
            Motivo de los {totalCambios === 1 ? "cambios" : `${totalCambios} cambios`}{" "}
            <span className="font-medium text-admin-texto-3">(obligatorio · 5 a 300 caracteres · uno para todos)</span>
          </label>
          {rechazos > 0 ? (
            <p role="note" className="m-0 rounded-12 bg-admin-rojo-fondo p-3 text-14 leading-145 text-admin-rojo-claro">
              <strong className="text-admin-rojo-2">
                Rechazas {rechazos} {rechazos === 1 ? "solicitud" : "solicitudes"}:
              </strong>{" "}
              este motivo también es el motivo del rechazo y el asociado lo verá en su correo y en su cuenta.
            </p>
          ) : null}
          {cambiosCedula > 0 ? (
            <p role="note" className="m-0 rounded-12 bg-admin-ambar-fondo p-3 text-14 leading-145 text-admin-ambar">
              <strong>La cédula es con lo que la persona ingresa a su cuenta.</strong> Desde que la guardes, solo podrá entrar con la
              nueva. El motivo no debe incluir números de cédula.
            </p>
          ) : null}
          <textarea
            id="motivo-tabla"
            rows={2}
            maxLength={300}
            required
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            aria-invalid={errorMotivo ? true : undefined}
            aria-describedby={errorMotivo ? "motivo-tabla-error" : undefined}
            placeholder="Ej.: Datos corregidos con el documento; revisión del comité."
            className="resize-none rounded-12 bg-admin-fondo p-3 text-16 leading-140 text-admin-texto shadow-[inset_0_0_0_1px_var(--ga-admin-borde)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-admin-verde)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--ga-admin-rojo)]"
          />
          {errorMotivo ? (
            <p id="motivo-tabla-error" className="m-0 text-13 font-semibold text-admin-rojo-2">
              {errorMotivo}
            </p>
          ) : null}
          {errorGeneral ? <p className="m-0 text-13 font-semibold text-admin-rojo-2">{errorGeneral}</p> : null}
          <div className="flex gap-2.5">
            <button
              type="submit"
              disabled={enviando}
              aria-busy={enviando || undefined}
              className="flex h-11.5 flex-1 items-center justify-center rounded-full bg-admin-verde text-15 font-extrabold text-admin-fondo disabled:opacity-85"
            >
              {enviando ? "Guardando…" : "Confirmar y guardar"}
            </button>
            <button
              type="button"
              onClick={() => setPidiendoMotivo(false)}
              disabled={enviando}
              className="flex h-11.5 items-center rounded-full px-4.5 text-15 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {/* En celular la tabla se desplaza dentro de su caja (la página no); la primera columna queda fija. */}
      <div className="max-w-full overflow-x-auto rounded-20 bg-admin-superficie">
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-14">
          <caption className="sr-only">
            Créditos en estado {estadoFiltro}. Toca un encabezado para ordenar.
            {soloLectura ? " Solo lectura." : " Las celdas con borde ámbar tienen cambios sin guardar."}
          </caption>
          <thead>
            <tr>
              {columnas.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  aria-sort={orden?.columna === c ? (orden.asc ? "ascending" : "descending") : undefined}
                  className={cx(
                    "border-b border-admin-borde-sutil bg-admin-superficie px-3 py-3 text-12 font-bold uppercase tracking-etiqueta text-admin-texto-3",
                    i === 0 && "sticky left-0 z-20",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => alternarOrden(c)}
                    className="flex items-center gap-1 rounded-6 uppercase outline-none hover:text-admin-texto focus-visible:shadow-[0_0_0_2px_var(--ga-admin-verde)]"
                  >
                    {ETIQUETA_COLUMNA[c]}
                    <span aria-hidden="true" className="w-3 text-admin-texto-2">
                      {orden?.columna === c ? (orden.asc ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} className="p-9 text-center text-15 text-admin-texto-3">
                  Nada por aquí. Cuando llegue una solicitud la verás aparecer resaltada.
                </td>
              </tr>
            ) : (
              visibles.map((f, indice) => (
                <FilaTabla
                  key={f.id}
                  fila={f}
                  numero={indice + 1}
                  columnas={columnas}
                  soloLectura={soloLectura}
                  edicion={ediciones[f.asociado_id] ?? {}}
                  decision={decisiones[f.id]}
                  bloqueaAprobar={situacionTope(paquetesPorGrado, f).bloqueaAprobar}
                  errores={[erroresServidor[`datos:${f.asociado_id}`], erroresServidor[`cedula:${f.asociado_id}`], erroresServidor[`estado:${f.id}`]].filter(
                    (x): x is string => Boolean(x),
                  )}
                  onEditar={(campo, valor) => editarPersona(f, campo, valor)}
                  onDecidir={(valor) => decidir(f, valor)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilaTabla({
  fila: f,
  numero,
  columnas,
  soloLectura,
  edicion,
  decision,
  bloqueaAprobar,
  errores,
  onEditar,
  onDecidir,
}: {
  fila: FilaCreditoPanel;
  numero: number;
  columnas: Columna[];
  soloLectura: boolean;
  edicion: EdicionPersona;
  decision: Decision | undefined;
  bloqueaAprobar: boolean;
  errores: string[];
  onEditar: (campo: CampoPersona, valor: string) => void;
  onDecidir: (valor: string) => void;
}) {
  // RS-01: ni sus propios datos ni los de sus clientes; nadie resuelve su propio crédito.
  const editaPersona = !soloLectura && !f.es_cliente_propio;
  const editaEstado = !soloLectura && f.estado === "pendiente" && !f.es_propia;
  const idError = `tabla-error-${f.id}`;
  const etiquetaFila = `Fila ${numero} (${f.nombre})`;

  function celdaPersona(campo: CampoPersona, extra?: { inputMode?: "numeric" | "tel"; ancho: string }) {
    const original = originalPersona(f, campo);
    if (!editaPersona) {
      return <span className={campo === "nombre" ? "font-extrabold text-white" : "text-admin-texto-2"}>{original || "—"}</span>;
    }
    const cambiado = edicion[campo] !== undefined;
    const valor = edicion[campo] ?? original;
    const error = cambiado ? errorDeCelda(campo, valor) : undefined;
    const idCelda = `tabla-${campo}-${f.id}`;
    return (
      <div className={cx("flex flex-col gap-1", extra?.ancho)}>
        <input
          id={idCelda}
          value={valor}
          onChange={(e) => onEditar(campo, e.target.value)}
          aria-label={`${etiquetaFila}: ${ETIQUETA_COLUMNA[campo].toLowerCase()}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${idCelda}-error` : errores.length > 0 ? idError : undefined}
          inputMode={extra?.inputMode}
          autoComplete="off"
          maxLength={campo === "nombre" ? 120 : 16}
          className={cx(CLASE_CONTROL, cambiado && CLASE_CAMBIADA, campo === "nombre" && "font-bold")}
        />
        {error ? (
          <span id={`${idCelda}-error`} className="text-12 font-semibold text-admin-rojo-2">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  function contenido(c: Columna) {
    switch (c) {
      case "nombre":
        return celdaPersona("nombre", { ancho: "w-[210px]" });
      case "cedula":
        return celdaPersona("cedula", { inputMode: "numeric", ancho: "w-[130px]" });
      case "telefono":
        return celdaPersona("telefono", { inputMode: "tel", ancho: "w-[140px]" });
      case "grado":
        return f.grado;
      case "recibe":
        return <span className="font-mono font-bold tabular-nums">{formatearPesos(f.monto_solicitado)}</span>;
      case "devuelve":
        return f.total_a_pagar === null ? (
          <span className="text-admin-texto-3">Sin definir</span>
        ) : (
          <span className="font-mono tabular-nums">{formatearPesos(f.total_a_pagar)}</span>
        );
      case "plazo":
        return `${f.plazo_meses} ${f.plazo_meses === 1 ? "mes" : "meses"}`;
      case "porcentaje":
        return `${f.porcentaje_credito}%`;
      case "tipo":
        return textoTipo(f);
      case "solicitud":
        return formatearFecha(f.fecha_solicitud);
      case "estado":
        if (!editaEstado) {
          return (
            <span className="flex flex-col items-start gap-1">
              <ChipEstado estado={f.estado} />
              {!soloLectura && f.estado === "pendiente" && f.es_propia ? (
                <span className="text-12 text-admin-texto-3">Tuya: otro admin la resuelve</span>
              ) : null}
            </span>
          );
        }
        return (
          <div className="flex w-[150px] flex-col gap-1">
            <select
              value={decision ?? "pendiente"}
              onChange={(e) => onDecidir(e.target.value)}
              aria-label={`${etiquetaFila}: estado`}
              aria-describedby={bloqueaAprobar ? `tabla-tope-${f.id}` : errores.length > 0 ? idError : undefined}
              className={cx(
                CLASE_CONTROL,
                decision === "aprobado" && "bg-admin-verde-fondo shadow-[inset_0_0_0_1.5px_var(--ga-admin-ambar)]",
                decision === "rechazado" && "bg-admin-rojo-fondo shadow-[inset_0_0_0_1.5px_var(--ga-admin-ambar)]",
              )}
            >
              <option value="pendiente">Pendiente</option>
              <option value="aprobado" disabled={bloqueaAprobar}>
                Aprobar
              </option>
              <option value="rechazado">Rechazar</option>
            </select>
            {bloqueaAprobar ? (
              <span id={`tabla-tope-${f.id}`} className="text-12 text-admin-rojo-2">
                Supera el tope: edita sus condiciones en la ficha para aprobarla
              </span>
            ) : null}
          </div>
        );
      case "desembolso":
        if (f.estado !== "aprobado") return <span className="text-admin-texto-3">—</span>;
        return f.fecha_desembolso ? formatearFecha(f.fecha_desembolso) : <span className="text-admin-ambar">Pendiente</span>;
    }
  }

  return (
    <>
      <tr>
        {columnas.map((c, i) => (
          <td
            key={c}
            className={cx(
              CLASE_CELDA,
              "whitespace-nowrap text-admin-texto-2",
              // Primera columna fija al desplazar en celular (con fondo para tapar lo que pasa por debajo).
              i === 0 && "sticky left-0 z-10 bg-admin-superficie",
              errores.length > 0 && i === 0 && "shadow-[inset_3px_0_0_var(--ga-admin-rojo)]",
            )}
          >
            {contenido(c)}
          </td>
        ))}
      </tr>
      {errores.length > 0 ? (
        <tr>
          <td colSpan={columnas.length} className="border-b border-admin-borde-sutil bg-admin-rojo-fondo px-3 py-2">
            <p id={idError} className="sticky left-3 m-0 max-w-[calc(100vw-4rem)] text-13 font-semibold text-admin-rojo-2">
              No se guardó: {errores.join(" · ")}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}
