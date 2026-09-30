import Image from "next/image";
import { ButtonLink } from "@/components/ui/Button";
import { IconoCheck } from "@/components/ui/Iconos";
import { ListaNumerada } from "@/components/ui/ListaNumerada";
import { Logo } from "@/components/ui/Logo";

export type AfiliacionEnviadaProps = {
  /** Correo enmascarado del solicitante (desde la cookie/flash del envío). */
  correoEnmascarado: string;
  /** Tiempo de respuesta (lib/config.ts → TIEMPO_RESPUESTA), p. ej. «poco tiempo». */
  tiempoRespuesta: string;
};

/** Confirmación de afiliación (pieza 3c: comprobante con sello, docs/Green Alliance C+.dc.html). */
export function AfiliacionEnviada({ correoEnmascarado, tiempoRespuesta }: AfiliacionEnviadaProps) {
  return (
    <div className="min-h-dvh bg-white lg:flex lg:items-center lg:justify-center lg:bg-ga-fondo-suave lg:p-12">
      {/* Celular: la maqueta deja 56 px arriba para simular la barra de estado del teléfono;
          en el navegador se usa 24 px (mismo margen lateral), como en /ingresar y /afiliacion. */}
      {/* md:min-h-0: en tableta el botón no debe quedar pegado al fondo (mt-auto)
          dejando un hueco grande; desde lg se vuelve a centrar con la tarjeta (520 px, pieza 3c). */}
      <main className="relative flex min-h-dvh flex-col gap-5.5 px-6 pb-7 pt-6 md:min-h-0 md:mx-auto md:max-w-xl lg:w-tarjeta-enviada lg:max-w-none lg:items-center lg:rounded-32 lg:bg-white lg:px-12 lg:pb-10 lg:pt-12 lg:text-center lg:shadow-comprobante">
        {/* Sello: isotipo en un círculo punteado, ligeramente girado (solo escritorio,
            igual que en la pieza 3c: en celular no hay maqueta para este adorno). */}
        <span
          aria-hidden="true"
          className="absolute -top-[30px] -right-10 hidden h-[84px] w-[84px] items-center justify-center rounded-full border-2 border-dashed border-ga-ambar bg-ga-ambar-fondo-suave motion-safe:animate-ga-sello motion-reduce:rotate-[-10deg] lg:flex"
        >
          <Image src="/logos/vector/green-alliance-isotipo.svg" alt="" width={42} height={42} />
        </span>
        <Logo variant="apilado" className="w-[190px] self-center lg:w-[200px]" />
        <div className="flex flex-col items-center gap-2.5 text-center lg:gap-5.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde">
            <IconoCheck tamano={28} grosor={2.4} trazo />
          </span>
          <h1 className="m-0 font-display text-28 font-extrabold text-ga-navy lg:text-32">
            ¡Solicitud enviada!
          </h1>
          <p className="m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155">
            El equipo de la cooperativa ya recibió tus datos. Te enviamos una copia a{" "}
            <strong>{correoEnmascarado}</strong>.
            <span className="hidden lg:inline">
              {" "}
              Te contactaremos en {tiempoRespuesta} por WhatsApp o correo.
            </span>
          </p>
        </div>
        <section className="flex flex-col gap-3.5 rounded-16 bg-ga-fondo-suave p-4.5 lg:hidden">
          <h2 className="m-0 text-16 font-extrabold">Qué sigue</h2>
          <ListaNumerada
            items={[
              `Revisamos tu solicitud en ${tiempoRespuesta}.`,
              "Te contactamos por WhatsApp o correo para completar la afiliación.",
              "Cuando quedes activo, ingresas con tu cédula y pides tu crédito.",
            ]}
          />
        </section>
        {/* Línea punteada con dos «muescas» redondas: solo escritorio, como en la pieza 3c
            (en celular el mismo lugar lo ocupa la sección «Qué sigue»). */}
        <div className="relative hidden w-full border-t-2 border-dashed border-ga-linea lg:block" aria-hidden="true">
          <span className="absolute -left-12 -top-[13px] h-6 w-6 rounded-full bg-ga-fondo-suave" />
          <span className="absolute -right-12 -top-[13px] h-6 w-6 rounded-full bg-ga-fondo-suave" />
        </div>
        <ButtonLink href="/" className="mt-auto lg:mt-0 lg:inline-flex lg:px-9">
          Volver al inicio
        </ButtonLink>
      </main>
    </div>
  );
}
