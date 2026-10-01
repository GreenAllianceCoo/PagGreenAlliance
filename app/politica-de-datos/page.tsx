import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BotonImprimir } from "@/components/ui/BotonImprimir";
import { clasesBoton } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { CORREO_CONTACTO, WHATSAPP_NUMERO } from "@/lib/config";
import {
  SECCIONES_POLITICA,
  type BloquePolitica,
  type SubseccionPolitica,
} from "@/lib/politica-datos-contenido";
import { VERSION_POLITICA_DATOS, VIGENTE_DESDE_POLITICA_DATOS } from "@/lib/politica-datos";

export const metadata: Metadata = {
  title: "Política de tratamiento de datos · Cooperativa Green Alliance",
};

/**
 * /politica-de-datos (mapa de botones §5). No hay diseño: reutiliza el
 * encabezado y los tamaños de texto de /afiliacion.
 * Texto íntegro de la política redactada por el Dr. Breinner Prieto (v1.0) en
 * lib/politica-datos-contenido.ts, más el anexo propio de la plataforma web.
 * Pendiente: horario de atención, órgano y acta de aprobación («Por definir»).
 */

const PARRAFO = "m-0 text-15 leading-150 text-ga-texto-2 lg:text-17 lg:leading-155 print:text-[11pt] print:leading-normal";
const LISTA = `${PARRAFO} flex list-disc flex-col gap-1.5 pl-5`;
const H2 = "m-0 text-20 font-extrabold leading-125 text-ga-navy lg:text-24 print:text-[14pt]";
const H3 = "m-0 text-16 font-extrabold leading-125 text-ga-navy lg:text-18 print:text-[12pt]";

// Secciones que el área jurídica todavía revisa (aviso discreto, no alarmante).
const EN_REVISION = new Set(["7.3", "8", "18"]);

function EnRevision() {
  return (
    <span className="ml-2 inline-block whitespace-nowrap rounded-full border border-ga-linea px-2 py-0.5 align-middle text-12 font-bold text-ga-texto-2">
      En revisión jurídica
    </span>
  );
}

function PorDefinir() {
  return <span className="italic underline decoration-dotted">Por definir</span>;
}

/** Convierte «[[PD]]» en «Por definir» discreto. */
function Texto({ t }: { t: string }) {
  const partes = t.split("[[PD]]");
  return (
    <>
      {partes.map((parte, i) => (
        <span key={i}>
          {parte}
          {i < partes.length - 1 ? <PorDefinir /> : null}
        </span>
      ))}
    </>
  );
}

function Bloques({ bloques }: { bloques: BloquePolitica[] }) {
  return (
    <>
      {bloques.map((b, i) =>
        "p" in b ? (
          <p key={i} className={PARRAFO}>
            <Texto t={b.p} />
          </p>
        ) : (
          <ul key={i} className={LISTA}>
            {b.items.map((it) => (
              <li key={it}>
                <Texto t={it} />
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

function Sub({ s }: { s: SubseccionPolitica }) {
  return (
    <div className="flex scroll-mt-6 flex-col gap-2" id={`s${s.num}`}>
      <h3 className={H3}>
        {s.num}. {s.titulo}
        {EN_REVISION.has(s.num) ? <EnRevision /> : null}
      </h3>
      <Bloques bloques={s.bloques} />
    </div>
  );
}

function Seccion({ id, titulo, children }: { id: string; titulo: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className={H2}>{titulo}</h2>
      {children}
    </section>
  );
}

const DATOS_PLATAFORMA = [
  "Nombres y apellidos, cédula, grado e institución (Policía o Ejército).",
  "Celular, número Nequi y cuenta de nómina.",
  "Correo personal y correo institucional.",
  "Fotos de la cédula (frente y reverso) y selfie.",
  "Datos del proceso ejecutivo, cuando lo hay.",
  "Solicitudes de crédito (monto, cuotas y estado).",
  "Boleta del sorteo mensual.",
];

const FINALIDADES_PLATAFORMA = [
  "Verificación de identidad.",
  "Afiliación a la cooperativa.",
  "Estudio, desembolso y seguimiento del crédito.",
  "Comunicación con el asociado (resultado de la afiliación y del crédito, código de ingreso).",
  "Sorteo mensual.",
];

export default function PoliticaDeDatosPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-ga-linea px-6 pb-5 pt-6 lg:h-19 lg:px-14 lg:py-0 print:border-0 print:px-0">
        <Link href="/" aria-label="Ir al inicio" className="block h-11 w-logo min-w-0 shrink">
          <Logo tone="dark" />
        </Link>
      </header>
      <main className="flex flex-col gap-8 px-6 py-6 md:mx-auto md:max-w-2xl lg:py-12 print:max-w-none print:px-0 print:py-4">
        <div className="flex flex-col gap-3">
          <h1 className="m-0 text-28 font-extrabold leading-115 text-ga-navy lg:text-40 lg:leading-110 print:text-[20pt]">
            Política de tratamiento de datos
          </h1>
          <p className={PARRAFO}>
            Política de privacidad y tratamiento de datos personales de la COOPERATIVA GREEN ALLIANCE (sigla COOP GREEN).
          </p>
          <p className={PARRAFO}>
            Versión {VERSION_POLITICA_DATOS}. Vigente desde el {VIGENTE_DESDE_POLITICA_DATOS}.
          </p>
          <ul className={LISTA}>
            <li>Responsable: COOPERATIVA GREEN ALLIANCE, NIT 902.103.335-7.</li>
            <li>Domicilio y dirección: Cr 78 No. 16 D 71, Bogotá D.C.</li>
            <li>
              Correo para protección de datos:{" "}
              <a className="enlace font-bold" href="mailto:greenalliancecooperativa@gmail.com">
                greenalliancecooperativa@gmail.com
              </a>
            </li>
            <li>Teléfono: 318 389 4034. WhatsApp: {WHATSAPP_NUMERO}.</li>
            <li>
              Página web: www.greenallianceco.com. Correo de soporte:{" "}
              <a className="enlace font-bold" href={`mailto:${CORREO_CONTACTO}`}>
                {CORREO_CONTACTO}
              </a>
              .
            </li>
            <li>Representante legal: Ricardo Varón Penagos.</li>
          </ul>
          <div className="print:hidden">
            <BotonImprimir className={clasesBoton("secundario", "w-full px-6 md:w-auto")}>
              Descargar en PDF
            </BotonImprimir>
          </div>
        </div>

        <nav aria-labelledby="indice-politica" className="flex flex-col gap-3 print:hidden">
          <h2 id="indice-politica" className={H2}>
            Índice
          </h2>
          <ol className="m-0 grid list-none gap-1.5 p-0 text-15 leading-150 lg:grid-cols-2 lg:text-16">
            {SECCIONES_POLITICA.map((s) => (
              <li key={s.num}>
                <a className="enlace" href={`#s${s.num}`}>
                  {s.num}. {s.titulo}
                </a>
              </li>
            ))}
            <li>
              <a className="enlace" href="#aprobacion">
                Aprobación
              </a>
            </li>
            <li>
              <a className="enlace" href="#anexo-plataforma">
                Anexo: tratamiento de datos en la plataforma web
              </a>
            </li>
          </ol>
        </nav>

        {SECCIONES_POLITICA.map((s) => (
          <Seccion
            key={s.num}
            id={`s${s.num}`}
            titulo={
              <>
                {s.num}. {s.titulo}
                {EN_REVISION.has(s.num) ? <EnRevision /> : null}
              </>
            }
          >
            <Bloques bloques={s.bloques} />
            {s.subs.map((x) => (
              <Sub key={x.num} s={x} />
            ))}
          </Seccion>
        ))}

        <Seccion id="aprobacion" titulo="Aprobación">
          <p className={PARRAFO}>
            La presente Política de Privacidad y Tratamiento de Datos Personales fue aprobada por <PorDefinir />{" "}
            (órgano competente de la COOPERATIVA GREEN ALLIANCE) mediante <PorDefinir /> (acta o decisión), de
            fecha <PorDefinir />.
          </p>
          <p className={PARRAFO}>
            <strong>COOPERATIVA GREEN ALLIANCE</strong>
            <br />
            Ricardo Varón Penagos, Representante Legal
            <br />
            NIT 902.103.335-7
          </p>
          <p className={PARRAFO}>
            Versión {VERSION_POLITICA_DATOS} – {VIGENTE_DESDE_POLITICA_DATOS}
          </p>
        </Seccion>

        <Seccion id="anexo-plataforma" titulo="Anexo: tratamiento de datos en la plataforma web">
          <p className={PARRAFO}>
            Este anexo explica, en términos sencillos, cómo se aplica la política en la plataforma web de la
            cooperativa.
          </p>
          <h3 className={H3}>Datos que recoge la plataforma</h3>
          <ul className={LISTA}>
            {DATOS_PLATAFORMA.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <h3 className={H3}>Para qué los usamos</h3>
          <ul className={LISTA}>
            {FINALIDADES_PLATAFORMA.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <h3 className={H3}>Quién ve tus datos</h3>
          <ul className={LISTA}>
            <li>Tu correo institucional solo recibe avisos, sin datos personales ni de tu crédito.</li>
            <li>Si ganas el sorteo, tu nombre y tu grado se muestran a los demás asociados.</li>
            <li>
              Los asesores ven datos limitados de sus clientes: no ven tu celular, tu correo, tu Nequi ni tus
              fotos.
            </li>
          </ul>
          <h3 className={H3}>Ingreso y cookies</h3>
          <p className={PARRAFO}>
            Para ingresar enviamos un código de un solo uso a tu correo personal. Usamos cookies de sesión,
            necesarias para mantener tu ingreso; no usamos cookies de publicidad.
          </p>
          <h3 className={H3}>Conservación y centrales de riesgo</h3>
          <p className={PARRAFO}>
            Conservamos tus datos como mínimo 3 años y medio. La cooperativa no reporta a centrales de riesgo.
          </p>
          <h3 className={H3}>Encargados con servidores en el exterior</h3>
          <ul className={LISTA}>
            <li>Supabase: base de datos y almacenamiento de fotos (Canadá).</li>
            <li>Vercel: alojamiento de la aplicación (Estados Unidos).</li>
            <li>Resend: envío de correos (Estados Unidos).</li>
          </ul>
          <p className={PARRAFO}>
            Esto es una transmisión internacional de datos personales a encargados que actúan por cuenta de la
            cooperativa y bajo sus instrucciones.
          </p>
        </Seccion>
      </main>
    </div>
  );
}
