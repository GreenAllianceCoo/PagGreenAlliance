"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buscarAsociadoPorCedula,
  crearCreditoAdmin,
  type AsociadoParaCredito,
  type EstadoBuscarAsociado,
  type EstadoCrearCredito,
} from "@/app/admin/creditos/actions";
import { formatearPesos } from "@/lib/cuenta";
import { interpolarPorcentaje, totalSugerido } from "@/lib/credito";
import type { CodigoGrado, PaqueteDemo } from "@/lib/asesor/datosDemo";
import { BotonAdmin, CampoAdmin, EntradaAdmin } from "./CamposAdmin";
import { FormularioCondiciones, type OpcionConvenio } from "./EditarCondicionesCredito";

const VACIO_BUSCAR: EstadoBuscarAsociado = {};
const VACIO_CREAR: EstadoCrearCredito = {};
/** Plazo que se propone si la tabla del grado no se pudo leer. */
const PLAZO_POR_DEFECTO = 3;

type Props = {
  /** Topes y tasas de `grados_credito` del panel (para sugerir lo que devuelve). */
  paquetesPorGrado: Partial<Record<CodigoGrado, PaqueteDemo[]>>;
  convenios: OpcionConvenio[];
  onCerrar: () => void;
  /** Se cierra el panel y se muestra el aviso (toast). */
  onCreado: (mensaje: string) => void;
};

/**
 * Panel «Nuevo crédito» de /admin/creditos (solo admin; el secretario no lo ve; el
 * botón que lo abre está en PanelCreditos): el admin busca al asociado por cédula,
 * revisa su grado, proceso y cupo, llena las mismas condiciones de «Editar
 * condiciones» y confirma. El crédito queda APROBADO, listo para «Marcar
 * desembolsado», y la lista pasa a la pestaña «Aprobado».
 */
export function NuevoCreditoAdmin({
  paquetesPorGrado,
  convenios,
  onCerrar,
  onCreado,
}: Props) {
  const router = useRouter();
  const [busqueda, buscar] = useActionState(buscarAsociadoPorCedula, VACIO_BUSCAR);
  const [cedula, setCedula] = useState("");
  const [estado, crear] = useActionState(async (previo: EstadoCrearCredito, datos: FormData) => {
    const resultado = await crearCreditoAdmin(previo, datos);
    if (resultado.mensaje) {
      // El crédito nace aprobado: se muestra en su pestaña.
      router.push("/admin/creditos?estado=aprobado");
      onCreado(resultado.mensaje);
    }
    return resultado;
  }, VACIO_CREAR);

  const asociado = busqueda.asociado;

  return (
    <section
      aria-labelledby="nuevo-credito-titulo"
      className="flex w-full flex-col gap-4 rounded-20 bg-admin-superficie p-5.5 motion-safe:animate-ga-aparecer"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="nuevo-credito-titulo" className="m-0 font-display text-22 font-extrabold">
          Nuevo crédito
        </h2>
        <button
          type="button"
          onClick={onCerrar}
          className="flex h-11 items-center rounded-full px-4.5 text-14 font-bold shadow-[inset_0_0_0_1px_var(--ga-admin-borde)]"
        >
          Cerrar
        </button>
      </div>
      <p className="m-0 text-14 leading-150 text-admin-texto-2">
        El crédito queda aprobado de una vez, sin que el asociado lo solicite. Después solo falta marcarlo como desembolsado.
      </p>

      <form action={buscar} noValidate className="flex flex-wrap items-end gap-2.5">
        <CampoAdmin id="nuevo-credito-cedula" label="Cédula del asociado" error={busqueda.error} className="min-w-0 flex-1">
          {(c) => (
            <EntradaAdmin
              {...c}
              name="cedula"
              inputMode="numeric"
              autoComplete="off"
              maxLength={16}
              required
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
            />
          )}
        </CampoAdmin>
        <BotonAdmin variante="borde" textoCargando="Buscando…" className="h-12">
          Buscar
        </BotonAdmin>
      </form>

      {asociado ? (
        <>
          <FichaAsociado asociado={asociado} />
          {asociado.bloqueos.length === 0 ? (
            <FormularioCondiciones
              // Otro asociado = formulario nuevo.
              key={asociado.id}
              prefijo="nuevo-credito"
              oculto={{ nombre: "asociadoId", valor: asociado.id }}
              inicial={{
                monto: "",
                totalAPagar: "",
                plazoMeses: String(asociado.plazoSugerido ?? PLAZO_POR_DEFECTO),
                porcentaje: "100",
                tipoCredito: "cooperativa",
                convenioId: null,
              }}
              sugerirTotal={(monto, plazo, porcentaje) => {
                const tasa = tasaDelGrado(paquetesPorGrado, asociado.grupo, porcentaje);
                return tasa === null ? null : totalSugerido(monto, tasa, plazo);
              }}
              convenios={convenios}
              estado={estado}
              accion={crear}
              onCancelar={onCerrar}
              etiquetaMotivo="Motivo del crédito"
              textoEnviar="Sí, crear y aprobar"
              textoCargando="Creando…"
              confirmacion={({ monto, plazoMeses, porcentaje }) => (
                <>
                  ¿Crear y aprobar un crédito de <strong>{monto !== null ? formatearPesos(monto) : "—"}</strong> a{" "}
                  <strong>{asociado.nombre}</strong>, a {plazoMeses} {plazoMeses === 1 ? "mes" : "meses"} y al {porcentaje} %?
                  {superaCupo(asociado, monto, porcentaje) ? (
                    <span className="mt-1.5 block text-14 text-admin-ambar">Supera el cupo de su grado: queda autorizado con tu motivo.</span>
                  ) : null}
                  <span className="mt-1.5 block text-14 text-admin-texto-2">Le enviaremos un correo con la aprobación.</span>
                </>
              )}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/** Nombre, grado, estado del proceso y cupo del grado al 50 % y 100 %. */
function FichaAsociado({ asociado }: { asociado: AsociadoParaCredito }) {
  return (
    <div className="flex flex-col gap-3 rounded-16 bg-admin-superficie-2 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-20 font-extrabold">{asociado.nombre}</span>
        <span className="text-14 text-admin-texto-2">C.C. {asociado.cedula}</span>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-2.5 text-14">
        <Dato termino="Grado">{asociado.grado ?? "Sin grado"}</Dato>
        <Dato termino="Proceso">{asociado.proceso ?? "Sin proceso"}</Dato>
        <Dato termino="Cupo al 50 %">{asociado.cupo50 !== null ? formatearPesos(asociado.cupo50) : "—"}</Dato>
        <Dato termino="Cupo al 100 %">{asociado.cupo100 !== null ? formatearPesos(asociado.cupo100) : "—"}</Dato>
      </dl>
      {asociado.bloqueos.length > 0 ? (
        <div role="status" className="rounded-14 bg-admin-rojo-fondo p-3.5 text-14 leading-145 text-admin-rojo-claro">
          <strong className="text-admin-rojo-2">No se le puede crear un crédito ahora.</strong>
          <ul className="m-0 mt-1.5 pl-5">
            {asociado.bloqueos.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Dato({ termino, children }: { termino: string; children: React.ReactNode }) {
  return (
    <div className="rounded-12 bg-admin-superficie px-3 py-2.5">
      <dt className="text-admin-texto-3">{termino}</dt>
      <dd className="m-0 font-bold">{children}</dd>
    </div>
  );
}

/** Tasa mensual del grado para un porcentaje (interpolada entre 50 % y 100 %); null si no se pudo leer. */
function tasaDelGrado(
  paquetesPorGrado: Partial<Record<CodigoGrado, PaqueteDemo[]>>,
  grupo: string | null,
  porcentaje: number,
): number | null {
  if (!grupo || porcentaje < 50 || porcentaje > 100) return null;
  const paquetes = paquetesPorGrado[grupo as CodigoGrado];
  const tasa50 = paquetes?.find((p) => p.porcentaje === "50")?.tasa_interes_mensual;
  const tasa100 = paquetes?.find((p) => p.porcentaje === "100")?.tasa_interes_mensual;
  if (tasa50 === undefined || tasa100 === undefined) return null;
  return interpolarPorcentaje(tasa50, tasa100, porcentaje);
}

/** Solo un aviso: el admin puede superar el cupo (la base lo permite con el motivo). */
function superaCupo(asociado: AsociadoParaCredito, monto: number | null, porcentaje: number) {
  if (monto === null || asociado.cupo50 === null || asociado.cupo100 === null) return false;
  if (porcentaje < 50 || porcentaje > 100) return false;
  return monto > Math.round(interpolarPorcentaje(asociado.cupo50, asociado.cupo100, porcentaje));
}
