import { normalizarCelularColombiano } from "@/lib/admin/whatsapp";

/**
 * Empresas en convenio (spec-requerimientos-ricardo §4, pieza 3n).
 * La fuente es la tabla `convenios` (servicios, sedes, NIT y WhatsApp en
 * `telefono_contacto`; migración 20260929100600). El loader está en
 * lib/conveniosServidor.ts. `CONVENIOS` es el RESPALDO si la tabla no se
 * puede leer: mismos textos literales de esa migración (no se inventa nada).
 */

export type Convenio = {
  emoji: string;
  nombre: string;
  /** Nombre corto que usa el diseño de /cuenta. */
  nombreCorto: string;
  especialidad: string;
  nit: string | null;
  descripcion: string | null;
  /** Una viñeta por servicio, en orden. */
  servicios: string[];
  /** Direcciones (vacío si no aplica). */
  sedes: string[];
  /** 10 dígitos (sin +57) o null. */
  whatsapp: string | null;
  /** «321 461 2714» o null. */
  whatsappTexto: string | null;
  /** https://wa.me/57…?text=… con el mensaje prellenado, o null si no hay número válido. */
  whatsappUrl: string | null;
};

/** Mensaje prellenado (pieza 3n): «…quiero conocer el beneficio con [marca]». */
export function mensajeWhatsappConvenio(nombre: string) {
  return `Hola, soy asociado de Green Alliance y quiero conocer el beneficio con ${nombre}.`;
}

/** Enlace wa.me del convenio (reusa la normalización de lib/admin/whatsapp.ts). */
export function enlaceWhatsappConvenio(telefono: string | null | undefined, nombre: string): string | null {
  const numero = normalizarCelularColombiano(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensajeWhatsappConvenio(nombre))}`;
}

/** «3214612714» → «321 461 2714». */
export function formatearCelular(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return /^3[0-9]{9}$/.test(digitos) ? digitos.replace(/^(\d{3})(\d{3})(\d{4})$/, "$1 $2 $3") : null;
}

type DatosBase = Omit<Convenio, "whatsappTexto" | "whatsappUrl">;

/** Completa los campos derivados (texto y enlace de WhatsApp). */
export function completarConvenio(base: DatosBase): Convenio {
  return {
    ...base,
    whatsappTexto: formatearCelular(base.whatsapp),
    whatsappUrl: enlaceWhatsappConvenio(base.whatsapp, base.nombre),
  };
}

/** Nombres cortos del diseño de /cuenta, por NIT (la tabla no los tiene). */
export const NOMBRE_CORTO_POR_NIT: Record<string, string> = {
  "902.038.118-7": "AMB Móvil",
  "901.865.816-3": "Locos por los Viajes",
  "1.090.464.475-4": "Dr. Ribero Dental",
  "1.054.095.149-3": "Racing Tours",
  "52.953.735-3": "Dream & Go Visas",
};

const BASE: DatosBase[] = [
  {
    emoji: "📱",
    nombre: "AMB Móvil S.A.S.",
    nombreCorto: "AMB Móvil",
    especialidad: "Tecnología",
    nit: "902.038.118-7",
    whatsapp: "3214612714",
    descripcion:
      "Como aliado estratégico, pondrá al alcance de nuestros asociados una amplia oferta de tecnología de punta, que incluye:",
    servicios: [
      "Teléfonos celulares nuevos y usados",
      "Retoma del equipo actual como parte de pago",
      "Servicio técnico especializado",
      "Cámaras de video",
      "Accesorios",
    ],
    sedes: [],
  },
  {
    emoji: "✈️",
    nombre: "Locos por los Viajes S.A.S.",
    nombreCorto: "Locos por los Viajes",
    especialidad: "Viajes y turismo",
    nit: "901.865.816-3",
    whatsapp: "3103397949",
    descripcion:
      "Con el respaldo de nuestra agencia de viajes de confianza, los asociados contarán con asesoría experta para planificar sus próximas vacaciones en familia, a través de:",
    servicios: [
      "Planes diseñados a la medida",
      "Vuelos nacionales e internacionales",
      "Hoteles y resorts",
      "Paquetes de vacaciones",
      "Circuitos turísticos",
      "Cruceros de ensueño",
    ],
    sedes: [],
  },
  {
    emoji: "🦷",
    nombre: "Dr. Ribero Dental Group",
    nombreCorto: "Dr. Ribero Dental",
    especialidad: "Odontología estética",
    nit: "1.090.464.475-4",
    whatsapp: "3144612829",
    descripcion:
      "Red de servicios de salud odontológica que da prioridad a la atención de nuestros asociados: un equipo humano altamente capacitado y materiales de primera calidad garantizan a cada paciente una experiencia cómoda y agradable.",
    servicios: [
      "Odontología general",
      "Estética dental",
      "Rehabilitación dental",
      "Endodoncia",
      "Periodoncia",
      "Implantología",
    ],
    sedes: [
      "Calle 140 # 11-45, Torre HHC, consultorio 313, Bogotá",
      "Carrera 29 # 45-45, Metropolitan Business Park, consultorio 1609, Bucaramanga",
    ],
  },
  {
    emoji: "🏞️",
    nombre: "Racing Tours Villa de Leyva",
    nombreCorto: "Racing Tours",
    especialidad: "Tours en Villa de Leyva",
    nit: "1.054.095.149-3",
    whatsapp: "3138008830",
    descripcion:
      "Empresa en convenio ubicada en el municipio de Villa de Leyva (Boyacá), donde los asociados encontrarán una amplia oferta de aventuras, atendida directamente por su propietario, con excelentes recorridos y vehículos de última generación.",
    servicios: ["Tour en cuatrimoto", "Tour en cabalgata (caballos)", "Pit bike", "Buggy", "Termales", "Chiva rumbera"],
    sedes: ["Villa de Leyva, Boyacá"],
  },
  {
    emoji: "🛂",
    nombre: "Dream & Go Visas",
    nombreCorto: "Dream & Go Visas",
    especialidad: "Trámite de visas",
    nit: "52.953.735-3",
    whatsapp: "3192544799",
    descripcion:
      "Mediante este convenio estratégico, ofreceremos acompañamiento integral durante la solicitud de visa, desde el inicio hasta su finalización. Profesionales especializados orientarán el diligenciamiento de formularios y evaluarán cada perfil para reducir el riesgo de rechazo en trámites individuales o grupales.",
    servicios: ["Visa Americana", "Visa Canadiense"],
    sedes: [],
  },
];

export const CONVENIOS: Convenio[] = BASE.map(completarConvenio);

/** Orden de la presentación (por NIT); los convenios nuevos van al final. */
export const ORDEN_POR_NIT: string[] = BASE.map((c) => c.nit ?? "");
