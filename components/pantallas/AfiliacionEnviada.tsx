import { ButtonLink } from "@/components/ui/Button";
import { IconoCheck } from "@/components/ui/Iconos";
import { ListaNumerada } from "@/components/ui/ListaNumerada";
import { Logo } from "@/components/ui/Logo";

export type AfiliacionEnviadaProps = {
  /** Correo enmascarado del solicitante (desde la cookie/flash del envío). */
  correoEnmascarado: string;
  /** Tiempo de respuesta (lib/config.ts → TIEMPO_RESPUESTA), p. ej. «4 horas o menos». */
  tiempoRespuesta: string;
};

/** Confirmación de afiliación (design/Enviada-PC.dc.html + Enviada-Movil.dc.html). */
export function AfiliacionEnviada({ correoEnmascarado, tiempoRespuesta }: AfiliacionEnviadaProps) {
  return (
    <div className="min-h-dvh bg-white lg:flex lg:items-center lg:justify-center lg:bg-ga-fondo-suave lg:p-12">
      {/* Celular: la maqueta deja 56 px arriba para simular la barra de estado del teléfono;
          en el navegador se usa 24 px (mismo margen lateral), como en /ingresar y /afiliacion. */}
      {/* md:min-h-0: en tableta el botón no debe quedar pegado al fondo (mt-auto)
          dejando un hueco grande; desde lg se vuelve a centrar con la tarjeta. */}
      <main className="flex min-h-dvh flex-col gap-5.5 px-6 pb-7 pt-6 md:min-h-0 md:mx-auto md:max-w-xl lg:w-tarjeta-enviada lg:max-w-none lg:items-center lg:rounded-24 lg:bg-white lg:px-14 lg:py-11 lg:text-center">
        <Logo variant="apilado" className="w-[190px] self-center lg:w-[200px]" />
        <div className="flex flex-col items-center gap-2.5 text-center lg:gap-5.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde">
            <IconoCheck tamano={28} grosor={2.4} />
          </span>
          <h1 className="m-0 text-28 font-extrabold text-ga-navy lg:text-32">¡Solicitud enviada!</h1>
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
        <ButtonLink href="/" className="mt-auto lg:mt-0 lg:inline-flex lg:px-9">
          Volver al inicio
        </ButtonLink>
      </main>
    </div>
  );
}
