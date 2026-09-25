import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { CORREO_CONTACTO, WHATSAPP_NUMERO } from "@/lib/config";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos · Cooperativa Green Alliance",
};

/**
 * /politica-de-datos (mapa de botones §5). No hay diseño: reutiliza el
 * encabezado y los tamaños de texto de /afiliacion.
 * BORRADOR (2026-09-24) según la Ley 1581 de 2012 y el Decreto 1377 de 2013
 * (compilado en el Decreto 1074 de 2015). Lo debe revisar la cooperativa, idealmente con
 * un abogado. Los datos que faltan van en <Pendiente>, resaltados en amarillo:
 * no desplegar a producción mientras quede alguno.
 */

/** Dato que falta confirmar con la cooperativa (se ve resaltado a propósito). */
function Pendiente({ children }: { children: ReactNode }) {
  return <mark className="rounded bg-yellow-200 px-1 text-ga-navy">[{children}]</mark>;
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-20 font-extrabold leading-125 text-ga-navy lg:text-24">{titulo}</h2>
      {children}
    </section>
  );
}

const PARRAFO = "m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155";
const LISTA = `${PARRAFO} flex list-disc flex-col gap-1.5 pl-5`;

export default function PoliticaDeDatosPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ga-linea px-6 pb-5 pt-6 lg:h-19 lg:px-14 lg:py-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="dark" />
        </Link>
      </header>
      <main className="flex flex-col gap-8 px-6 py-6 md:mx-auto md:max-w-2xl lg:py-12">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110">
            Política de tratamiento de datos
          </h1>
          <p className={PARRAFO}>
            Esta política explica qué datos personales recoge la Cooperativa Green Alliance, para qué los
            usa, con quién los comparte y cómo puedes consultarlos, corregirlos o pedir que los borremos.
            La aplicamos según la Ley 1581 de 2012 y el Decreto 1377 de 2013 (hoy compilado en el Decreto 1074 de 2015).
          </p>
          <p className={PARRAFO}>
            Vigente desde el <Pendiente>fecha de publicación</Pendiente>.
          </p>
        </div>

        <Seccion titulo="1. Quién es el responsable">
          <ul className={LISTA}>
            <li>
              <strong>Cooperativa Green Alliance</strong>, NIT <Pendiente>NIT</Pendiente>.
            </li>
            <li>
              Domicilio: <Pendiente>dirección y ciudad</Pendiente>.
            </li>
            <li>
              Correo: <a className="enlace font-bold" href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a>.
            </li>
            <li>WhatsApp: {WHATSAPP_NUMERO}.</li>
          </ul>
        </Seccion>

        <Seccion titulo="2. Qué datos recogemos">
          <p className={PARRAFO}>
            <strong>Cuando pides afiliarte:</strong> nombres y apellidos, cédula, grado, institución
            (Policía o Ejército), correo institucional, celular, número Nequi, el asesor que te acompaña
            (si lo eliges), el mensaje que nos escribas y tres fotos: tu cédula por el frente, por el
            reverso y una selfie.
          </p>
          <p className={PARRAFO}>
            <strong>Cuando ya eres asociado:</strong> las solicitudes de crédito que hagas (monto, número
            de cuotas y estado), tu inscripción y número de boleta en el sorteo mensual, y la fecha de tus
            ingresos a la plataforma.
          </p>
          <p className={PARRAFO}>
            <strong>Para proteger la plataforma:</strong> guardamos una huella cifrada de tu dirección IP y
            de tu cédula para limitar los intentos de ingreso y de envío de formularios. Con esa huella
            no se puede reconstruir el dato original y se borra en máximo un día.
          </p>
        </Seccion>

        <Seccion titulo="3. Datos sensibles: tu selfie y las fotos de tu cédula">
          <p className={PARRAFO}>
            Tu selfie y la foto de tu cédula permiten identificarte por tu rostro, por eso la ley las
            considera <strong>datos sensibles</strong>. Solo las usamos para confirmar que quien pide la
            afiliación eres tú y evitar que alguien se haga pasar por ti.
          </p>
          <p className={PARRAFO}>
            No estás obligado a entregarnos datos sensibles. Si prefieres no subir las fotos, no podemos
            verificar tu identidad por la página. En ese caso, escríbenos y te explicamos{" "}
            <Pendiente>otra forma de verificar tu identidad, p. ej. en persona con tu asesor</Pendiente>.
          </p>
          <p className={PARRAFO}>
            Las fotos se guardan en un almacenamiento privado. Solo las ven los administradores de la
            cooperativa mientras revisan tu solicitud. Tu asesor no las ve.
          </p>
        </Seccion>

        <Seccion titulo="4. Para qué usamos tus datos">
          <ul className={LISTA}>
            <li>Estudiar tu solicitud de afiliación y verificar tu identidad.</li>
            <li>Crear tu cuenta y enviarte los códigos de ingreso a tu correo.</li>
            <li>Estudiar tus solicitudes de crédito, desembolsarlas a tu Nequi y hacerles seguimiento.</li>
            <li>
              Avisarte por correo, celular o WhatsApp el resultado de tu afiliación o de tu crédito, y
              tu número de boleta del sorteo.
            </li>
            <li>Que tu asesor pueda acompañarte en tus trámites.</li>
            <li>Cumplir las obligaciones legales, contables y de control de la cooperativa.</li>
            <li>Prevenir fraudes y proteger la plataforma.</li>
          </ul>
          <p className={PARRAFO}>No vendemos ni alquilamos tus datos, y no los usamos para publicidad de terceros.</p>
        </Seccion>

        <Seccion titulo="5. Quién puede ver tus datos">
          <ul className={LISTA}>
            <li>
              <strong>Administradores de la cooperativa:</strong> todos los datos de tu afiliación y de tus
              créditos.
            </li>
            <li>
              <strong>Tu asesor:</strong> solo tu nombre, cédula, grado y el estado de tu afiliación y de tus
              créditos. No ve tu celular, tu correo, tu Nequi ni tus fotos.
            </li>
            <li>
              <strong>Proveedores tecnológicos</strong> que nos prestan el servicio y tratan los datos por
              cuenta nuestra y bajo nuestras instrucciones: Supabase (base de datos y almacenamiento de
              las fotos), Vercel (alojamiento de la página) y Resend (envío de correos).
            </li>
            <li>Autoridades que lo pidan con base en la ley.</li>
          </ul>
          <p className={PARRAFO}>
            Algunos de estos proveedores guardan la información en servidores fuera de Colombia{" "}
            <Pendiente>país o región de los servidores</Pendiente>. Al aceptar esta política autorizas
            esa transmisión. Ellos deben proteger tus datos con medidas iguales o mejores a las de esta
            política.
          </p>
        </Seccion>

        <Seccion titulo="6. Cuánto tiempo guardamos tus datos">
          <ul className={LISTA}>
            <li>
              <strong>Si tu afiliación se rechaza:</strong> borramos tus fotos a los{" "}
              <Pendiente>número de días</Pendiente> días de la decisión.
            </li>
            <li>
              <strong>Si eres asociado:</strong> las fotos se guardan <Pendiente>plazo</Pendiente>.
              Los demás datos se guardan mientras seas asociado y después durante el tiempo que exijan las
              normas contables y del sector cooperativo <Pendiente>plazo, p. ej. 10 años</Pendiente>.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="7. Tus derechos">
          <p className={PARRAFO}>Como titular de tus datos tienes derecho a:</p>
          <ul className={LISTA}>
            <li>Conocer, actualizar y corregir tus datos.</li>
            <li>Pedir una prueba de la autorización que nos diste.</li>
            <li>Saber, si lo pides, para qué hemos usado tus datos.</li>
            <li>
              Revocar tu autorización o pedir que borremos tus datos, salvo cuando la ley o un contrato
              vigente con la cooperativa (por ejemplo, un crédito sin pagar) nos obliguen a guardarlos.
            </li>
            <li>Consultar tus datos gratis.</li>
            <li>
              Presentar una queja ante la Superintendencia de Industria y Comercio después de haber hecho
              tu consulta o reclamo ante nosotros.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="8. Cómo hacer una consulta o un reclamo">
          <p className={PARRAFO}>
            Escríbenos a{" "}
            <a className="enlace font-bold" href={`mailto:${CORREO_CONTACTO}`}>{CORREO_CONTACTO}</a> con tu
            nombre completo, tu cédula, lo que necesitas y cómo te respondemos. Si lo pide otra persona
            por ti, debe demostrar que te representa.
          </p>
          <ul className={LISTA}>
            <li>
              <strong>Consultas</strong> (saber qué datos tenemos): respondemos en máximo 10 días hábiles.
              Si no alcanzamos, te avisamos el motivo y respondemos en máximo 5 días hábiles más.
            </li>
            <li>
              <strong>Reclamos</strong> (corregir, borrar o revocar): respondemos en máximo 15 días
              hábiles. Si no alcanzamos, te avisamos y respondemos en máximo 8 días hábiles más. Si al
              reclamo le falta información, te la pedimos en los 5 días siguientes. Si en 2 meses no nos
              la envías, entendemos que desististe.
            </li>
          </ul>
        </Seccion>

        <Seccion titulo="9. Cómo protegemos tus datos">
          <p className={PARRAFO}>
            Para ingresar a la plataforma se necesita un código de un solo uso que llega a tu correo. Cada
            persona ve solo lo que le corresponde según su rol. Las fotos están en un almacenamiento
            privado y la información viaja cifrada.
          </p>
        </Seccion>

        <Seccion titulo="10. Cambios a esta política">
          <p className={PARRAFO}>
            Si cambiamos algo importante de esta política, te avisaremos por correo antes de aplicarlo.
            La versión vigente siempre estará publicada en esta página.
          </p>
        </Seccion>
      </main>
    </div>
  );
}
