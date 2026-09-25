"use client";

/**
 * «Sorteo del mes» de /cuenta: botón de acceso + modal accesible con los 3
 * pasos de docs/spec-fase-2.md §4 (participar → confirmar → celebración).
 * Autocontenido: importa directamente las Server Actions de
 * app/cuenta/actions-sorteo.ts, así que components/pantallas/Cuenta.tsx solo
 * necesita renderizar <SorteoDelMes ... /> (no hay que tocar CuentaCliente.tsx).
 */
import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { cx } from "@/components/ui/cx";
import {
  confirmarBoletaSorteo,
  participarSorteo,
  reenviarBoletaSorteo,
  type EstadoConfirmarSorteo,
} from "@/app/cuenta/actions-sorteo";
import { generarConfeti } from "./confeti";
import css from "./confeti.module.css";

/** Código que acepta la vista previa de desarrollo (?sorteo=demo, ver lib/sorteo/demo.ts). */
const CODIGO_DEMO = "123456";
/** Correo y número de mentira de la vista previa: nunca sale de la base ni de Resend. */
const CORREO_DEMO = "ju•••@po•••.co";

/** Íconos propios (trazo, 24×24, `currentColor`) para no tocar components/ui/Iconos.tsx. */
function IconoRegalo({ tamano = 24, className }: { tamano?: number; className?: string }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M4 13h16" />
      <path d="M12 9v11" />
      <path d="M8 9c-1.8 0-3-1.1-3-2.5S6.2 4 8 4c2 0 4 2.5 4 5" />
      <path d="M16 9c1.8 0 3-1.1 3-2.5S17.8 4 16 4c-2 0-4 2.5-4 5" />
    </svg>
  );
}

function IconoBoleta({ tamano = 24 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z" />
      <path d="M14 6v12" strokeDasharray="2.5 2.5" />
    </svg>
  );
}

/** true si el navegador pide menos movimiento (respeta cambios en vivo). */
function usePrefiereMenosMovimiento() {
  // Valor inicial calculado en el propio useState (no en un efecto): evita
  // el re-render en cascada de fijarlo con setState dentro de un efecto.
  const [prefiere, setPrefiere] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const escuchar = (e: MediaQueryListEvent) => setPrefiere(e.matches);
    consulta.addEventListener("change", escuchar);
    return () => consulta.removeEventListener("change", escuchar);
  }, []);
  return prefiere;
}

const VACIO = Array.from({ length: 6 }, () => "");

export type EstadoBoletaSorteo = "sin-participar" | "enviada" | "confirmada";

export type SorteoDelMesProps = {
  /** del 1 al 5 de cada mes, hora de Colombia (lib/sorteo/fecha.ts). */
  ventanaAbierta: boolean;
  /** «octubre»: mes del sorteo en curso. */
  mesTexto: string;
  /** «1 de noviembre»: se muestra cuando la ventana está cerrada. */
  textoProximaApertura: string;
  estadoInicial: EstadoBoletaSorteo;
  /** Solo si `estadoInicial === "confirmada"` (nunca antes de confirmar). */
  numeroInicial: string | null;
  /**
   * Correo enmascarado calculado en el servidor (app/cuenta/page.tsx), para
   * poder mostrar el paso «confirmar» de una boleta "enviada" en sesiones
   * anteriores (F2-04, «Reenviar mi boleta»), sin depender de que el paso 1
   * se haya ejecutado en ESTA carga de la página.
   */
  correoEnmascarado?: string | null;
  /**
   * Vista previa SOLO de desarrollo (`/cuenta?sorteo=demo`, ver
   * lib/sorteo/demo.ts): abre el modal con datos simulados y nunca llama a
   * las Server Actions reales. `app/cuenta/page.tsx` ya se encarga de que
   * esto sea siempre `false` en producción.
   */
  demo?: boolean;
};

type Paso = "inicio" | "confirmar" | "celebracion";

export function SorteoDelMes({
  ventanaAbierta,
  mesTexto,
  textoProximaApertura,
  estadoInicial,
  numeroInicial,
  correoEnmascarado: correoEnmascaradoInicial = null,
  demo = false,
}: SorteoDelMesProps) {
  const router = useRouter();
  const yaParticipaba = estadoInicial === "confirmada";
  // F2-04: una boleta ya "enviada" (correo mandado, sin confirmar todavía)
  // abre directo en el paso de confirmar, con «Reenviar mi boleta» a mano en
  // vez de mandar de vuelta a «Quiero participar» (que fallaría: ya tiene boleta).
  const yaEnviada = estadoInicial === "enviada";
  const puedeAbrir = demo || ventanaAbierta || yaParticipaba || yaEnviada;

  const [abierto, setAbierto] = useState(demo);
  const [paso, setPaso] = useState<Paso>(yaParticipaba ? "celebracion" : yaEnviada ? "confirmar" : "inicio");
  // Solo se anima la celebración justo después de confirmar en esta sesión;
  // si el modal se abre directo en «ya estás participando», queda quieta.
  const [animarCelebracion, setAnimarCelebracion] = useState(false);
  const [correoEnmascarado, setCorreoEnmascarado] = useState<string | null>(
    demo ? CORREO_DEMO : correoEnmascaradoInicial,
  );
  const [numero, setNumero] = useState<string | null>(numeroInicial);
  const [digitos, setDigitos] = useState<string[]>(VACIO);
  const [reenviando, setReenviando] = useState(false);
  const [mensajeReenvio, setMensajeReenvio] = useState<string | undefined>(undefined);
  const [restanteReenvio, setRestanteReenvio] = useState(0);

  const botonAbrirRef = useRef<HTMLButtonElement | null>(null);
  const botonCerrarRef = useRef<HTMLButtonElement | null>(null);
  const dialogoRef = useRef<HTMLDivElement | null>(null);

  const prefiereMenosMovimiento = usePrefiereMenosMovimiento();
  const confeti = useMemo(
    () => (animarCelebracion ? generarConfeti(24, prefiereMenosMovimiento) : []),
    [animarCelebracion, prefiereMenosMovimiento],
  );

  const [estadoParticipar, accionParticipar, participando] = useActionState(async () => {
    if (demo) {
      // Vista previa: nunca llama a la base ni a Resend (lib/sorteo/demo.ts).
      setCorreoEnmascarado(CORREO_DEMO);
      setDigitos(VACIO);
      setPaso("confirmar");
      return { ok: true, correoEnmascarado: CORREO_DEMO };
    }
    const resultado = await participarSorteo();
    if (resultado.ok) {
      setCorreoEnmascarado(resultado.correoEnmascarado ?? null);
      setDigitos(VACIO);
      setPaso("confirmar");
    }
    return resultado;
  }, {});

  const [estadoConfirmar, accionConfirmar, confirmando] = useActionState(
    async (previo: EstadoConfirmarSorteo, formData: FormData) => {
      if (demo) {
        // Solo el código fijo "123456" pasa la vista previa; cualquier otro
        // se trata igual que un número que no coincide (sin tocar la base).
        const escrito = Array.from({ length: 6 }, (_, i) => String(formData.get(`numero-${i + 1}`) ?? "")).join("");
        if (escrito === CODIGO_DEMO) {
          setNumero(CODIGO_DEMO);
          setAnimarCelebracion(true);
          setPaso("celebracion");
          return { ok: true, numero: CODIGO_DEMO };
        }
        setDigitos(VACIO);
        return { error: "El número no coincide con tu boleta.", intentosRestantes: 4 };
      }
      const resultado = await confirmarBoletaSorteo(previo, formData);
      if (resultado.ok) {
        setNumero(resultado.numero ?? null);
        setAnimarCelebracion(true);
        setPaso("celebracion");
        router.refresh();
      } else {
        setDigitos(VACIO);
      }
      return resultado;
    },
    {},
  );

  /** F2-04: reenvía el correo con el mismo número (sin generar uno nuevo). */
  async function alReenviar() {
    if (demo || reenviando || restanteReenvio > 0) return;
    setReenviando(true);
    setMensajeReenvio(undefined);
    const resultado = await reenviarBoletaSorteo();
    setReenviando(false);
    if (resultado.ok) {
      setCorreoEnmascarado(resultado.correoEnmascarado ?? correoEnmascarado);
      setMensajeReenvio(`Te lo volvimos a enviar a ${resultado.correoEnmascarado ?? "tu correo"}.`);
      setRestanteReenvio(45);
    } else {
      setMensajeReenvio(resultado.error);
    }
  }

  // Cuenta regresiva de 45 s para «Reenviar mi boleta» (mismo criterio que
  // «Reenviar código» de /ingresar/codigo: un solo intervalo, siempre corriendo).
  useEffect(() => {
    const id = setInterval(() => setRestanteReenvio((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  function abrir() {
    setAbierto(true);
  }

  function cerrar() {
    setAbierto(false);
    botonAbrirRef.current?.focus();
    // La animación de celebración es solo para el momento justo después de
    // confirmar: si vuelve a abrir el modal más tarde (sin recargar la
    // página), que se vea la versión quieta «Ya estás participando con…».
    if (paso === "celebracion") setAnimarCelebracion(false);
  }

  // Foco atrapado + Esc. aria-modal ya evita que los lectores de pantalla
  // salgan del diálogo; esto cubre el foco de teclado.
  function alTeclado(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key === "Escape") {
      evento.stopPropagation();
      cerrar();
      return;
    }
    if (evento.key !== "Tab") return;
    const focoables = dialogoRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!focoables || focoables.length === 0) return;
    const primero = focoables[0];
    const ultimo = focoables[focoables.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  // Foco inicial al abrir + bloquear el scroll del fondo.
  useEffect(() => {
    if (!abierto) return;
    botonCerrarRef.current?.focus();
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  const digitosCompletos = digitos.every((d) => /^[0-9]$/.test(d));
  const idTitulo = "sorteo-modal-titulo";

  return (
    <>
      <button
        type="button"
        ref={botonAbrirRef}
        onClick={abrir}
        disabled={!puedeAbrir}
        aria-haspopup="dialog"
        className={cx(
          "col-span-2 flex flex-col gap-2.5 rounded-16 p-4.5 text-15 font-bold no-underline lg:col-span-1 lg:flex-row lg:items-center lg:gap-3 lg:p-5 lg:text-16 lg:font-extrabold",
          puedeAbrir
            ? "bg-ga-ambar-fondo text-ga-ambar-texto hover:bg-ga-ambar-fondo/80"
            : "cursor-not-allowed bg-white text-ga-texto-3 opacity-70",
          ventanaAbierta && css.pulso,
        )}
      >
        <IconoRegalo tamano={22} className={puedeAbrir ? "text-ga-ambar-texto" : "text-ga-texto-3"} />
        {puedeAbrir ? "Sorteo del mes" : `Próximo sorteo: ${textoProximaApertura}`}
      </button>

      {abierto ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ga-texto/50 p-4"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) cerrar();
          }}
        >
          <div
            ref={dialogoRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            onKeyDown={alTeclado}
            className="relative flex max-h-[90vh] w-full max-w-md flex-col items-center gap-4 overflow-y-auto rounded-18 bg-white p-6 text-center lg:p-8"
          >
            <button
              type="button"
              ref={botonCerrarRef}
              onClick={cerrar}
              aria-label="Cerrar"
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-ga-texto-3 hover:bg-ga-fondo-suave"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l14 14M19 5L5 19" />
              </svg>
            </button>

            {paso === "inicio" ? (
              <>
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 items-center justify-center rounded-full bg-ga-ambar-fondo text-ga-ambar-texto"
                >
                  <IconoRegalo tamano={28} />
                </span>
                <h2 id={idTitulo} className="m-0 text-20 font-extrabold text-ga-navy">
                  ¡Participa en el sorteo de {mesTexto}!
                </h2>
                <p className="m-0 text-15 leading-150 text-ga-texto-2">
                  Te enviaremos un número de boleta a tu correo. El ganador se anunciará por los canales
                  oficiales de Green Alliance.
                </p>
                <form action={accionParticipar} className="w-full">
                  <Button cargando={participando} textoCargando="Enviando…" className="w-full">
                    Quiero participar
                  </Button>
                </form>
                {estadoParticipar.error ? (
                  <p role="alert" className="m-0 text-14 font-semibold text-ga-error">
                    {estadoParticipar.error}
                  </p>
                ) : null}
              </>
            ) : null}

            {paso === "confirmar" ? (
              <>
                <h2 id={idTitulo} className="m-0 text-20 font-extrabold text-ga-navy">
                  Te enviamos tu número de boleta a {correoEnmascarado}
                </h2>
                <p className="m-0 text-15 leading-150 text-ga-texto-2">
                  Escríbelo aquí para confirmar tu participación.
                </p>
                <form action={accionConfirmar} className="flex w-full flex-col items-center gap-4">
                  <OtpInput name="numero" valores={digitos} onCambio={setDigitos} error={estadoConfirmar.error} />
                  <Button
                    cargando={confirmando}
                    textoCargando="Confirmando…"
                    disabled={!digitosCompletos}
                    className="w-full"
                  >
                    Confirmar
                  </Button>
                </form>
                {typeof estadoConfirmar.intentosRestantes === "number" ? (
                  <p role="status" className="m-0 text-13 text-ga-texto-3">
                    Te quedan {estadoConfirmar.intentosRestantes} intentos.
                  </p>
                ) : null}
                {/* F2-04: para quien ya tiene boleta "enviada" pero el correo se
                    perdió (o llegó tarde) y no quiere esperar un reintento manual. */}
                {!demo ? (
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={alReenviar}
                      disabled={reenviando || restanteReenvio > 0}
                      className="text-14 font-bold text-ga-verde underline decoration-1 underline-offset-2 disabled:cursor-not-allowed disabled:text-ga-texto-3 disabled:no-underline"
                    >
                      {reenviando
                        ? "Reenviando…"
                        : restanteReenvio > 0
                          ? `Reenviar mi boleta (${restanteReenvio}s)`
                          : "Reenviar mi boleta"}
                    </button>
                    {mensajeReenvio ? (
                      <p role="status" className="m-0 text-13 text-ga-texto-3">
                        {mensajeReenvio}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}

            {paso === "celebracion" ? (
              <>
                <div
                  className={cx(
                    "relative flex h-20 w-20 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde",
                    animarCelebracion && css.boletaEntrada,
                  )}
                >
                  <IconoBoleta tamano={34} />
                  {confeti.map((pieza) => (
                    <span
                      key={pieza.id}
                      aria-hidden="true"
                      className={css.confeti}
                      style={{
                        left: `${pieza.izquierda}%`,
                        backgroundColor: pieza.color,
                        animationDelay: `${pieza.retraso}s`,
                        animationDuration: `${pieza.duracion}s`,
                        transform: `rotate(${pieza.rotacion}deg)`,
                      }}
                    />
                  ))}
                </div>
                <h2 id={idTitulo} className="m-0 text-20 font-extrabold text-ga-navy">
                  {animarCelebracion ? "¡Ya estás participando!" : `Ya estás participando con la boleta ${numero ?? ""}`}
                </h2>
                {animarCelebracion ? (
                  <p
                    className="m-0 flex justify-center gap-1 text-34 font-extrabold text-ga-navy"
                    aria-label={`Tu número de boleta es ${numero ?? ""}`}
                  >
                    {(numero ?? "").split("").map((digito, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className={css.digito}
                        style={{ animationDelay: `${i * 0.08}s` }}
                      >
                        {digito}
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="m-0 text-34 font-extrabold text-ga-navy">{numero}</p>
                )}
                <p className="m-0 text-14 text-ga-texto-3">
                  El ganador se anunciará por los canales oficiales de Green Alliance.
                </p>
                <Button type="button" variante="secundario" onClick={cerrar} className="w-full">
                  Cerrar
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
