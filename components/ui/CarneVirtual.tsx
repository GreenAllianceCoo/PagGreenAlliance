import Image from "next/image";
import Link from "next/link";
import { enmascararCedula } from "@/lib/mascara";

export type CarneVirtualProps = {
  nombre: string;
  grado: string;
  institucion?: string;
  /** Cédula sin enmascarar; el componente la enmascara. */
  cedula: string;
  /** `undefined` = sin el dato: no se dibuja el chip de estado. */
  activo?: boolean;
  /** Destino de «Ver carné con QR» (el QR vive en su propia pantalla). `null` = sin enlace (ya estás ahí). */
  hrefQr?: string | null;
  /** Destino de «Ver empresas en convenio». */
  hrefConvenios?: string;
};

/**
 * Carné virtual del asociado (5.12 / P-109), estilo C+: tarjeta verde oscuro con
 * logo, «Afiliado Titular», nombre, grado, institución y cédula enmascarada.
 * Presentacional: solo recibe props. Nunca muestra la tasa.
 * Pieza 3u: en escritorio va en grilla 1.3fr/1fr con una columna lateral («Para usarlo en un
 * convenio»); en celular, el carné y debajo el enlace «Ver empresas en convenio».
 */
export function CarneVirtual({
  nombre,
  grado,
  institucion,
  cedula,
  activo,
  hrefQr = "/cuenta/carne",
  hrefConvenios = "#convenios",
}: CarneVirtualProps) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-6">
    <section
      aria-label="Carné de asociado"
      className="relative flex w-full max-w-[700px] flex-col gap-4 overflow-hidden rounded-28 bg-ga-verde-oscuro p-5.5 text-white lg:p-9"
    >
      {/* Manchas decorativas */}
      <span
        aria-hidden="true"
        className="absolute -right-[50px] -top-14 h-[190px] w-[190px] bg-ga-verde"
        style={{ borderRadius: "58% 42% 55% 45% / 48% 58% 42% 52%" }}
      />
      <span
        aria-hidden="true"
        className="absolute -bottom-[60px] -left-10 h-[150px] w-[150px] bg-ga-verde-mancha"
        style={{ borderRadius: "44% 56% 62% 38% / 52% 40% 60% 48%" }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <Image
          src="/logos/blanco/green-alliance-wordmark-blanco.svg"
          alt="Cooperativa Green Alliance"
          width={4118}
          height={669}
          className="h-[34px] w-auto max-w-[60%]"
        />
        {activo !== undefined ? (
          <span className="rounded-full bg-ga-menta px-2.5 py-1 text-13 font-extrabold text-ga-navy-chip-oscuro">
            {activo ? "Asociado activo" : "Asociado inactivo"}
          </span>
        ) : null}
      </div>
      <span className="relative text-13 font-bold uppercase tracking-etiqueta text-ga-menta-suave">
        Afiliado Titular
      </span>
      <strong className="relative break-words font-display text-22 font-extrabold lg:text-34">{nombre}</strong>
      <dl className="relative m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-14">
        <div className="min-w-0">
          <dt className="text-12 text-ga-menta-suave">Grado</dt>
          <dd className="m-0 break-words font-bold">{grado}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-12 text-ga-menta-suave">Cédula</dt>
          <dd className="m-0 font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {enmascararCedula(cedula)}
          </dd>
        </div>
        {institucion ? (
          <div className="col-span-2 min-w-0">
            <dt className="text-12 text-ga-menta-suave">Institución</dt>
            <dd className="m-0 break-words font-bold">{institucion}</dd>
          </div>
        ) : null}
      </dl>
      <span className="relative text-14 text-ga-menta-suave">Muéstralo en cada empresa en convenio.</span>
    </section>
    <aside className="flex flex-col gap-3 lg:rounded-28 lg:bg-white lg:p-[26px]">
      <h2 className="m-0 hidden font-display text-20 font-extrabold text-ga-navy lg:block">Para usarlo en un convenio</h2>
      <p className="m-0 hidden text-15 leading-150 text-ga-texto-2 lg:block">
        Abre esta pantalla y muéstrasela a la empresa en convenio junto con tu documento. El carné no es un documento de identidad.
      </p>
      <Link
        href={hrefConvenios}
        className="flex h-12 items-center justify-center rounded-full border-1.5 border-ga-navy text-15 font-extrabold text-ga-navy no-underline transition-colors duration-200 hover:bg-ga-fondo-suave focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
      >
        Ver empresas en convenio
      </Link>
      {hrefQr ? (
        <Link
          href={hrefQr}
          className="flex h-12 items-center justify-center rounded-full bg-ga-verde text-15 font-extrabold text-white no-underline transition-colors duration-200 hover:bg-ga-verde-oscuro hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
        >
          Ver carné con QR
        </Link>
      ) : null}
    </aside>
    </div>
  );
}
