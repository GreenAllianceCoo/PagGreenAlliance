import type { Metadata } from "next";
import { Cuenta } from "@/components/pantallas/Cuenta";
import { ASOCIADO_EJEMPLO, CONVENIOS_EJEMPLO, SOLICITUD_EJEMPLO } from "@/lib/mock";

export const metadata: Metadata = {
  title: "Mi cuenta · Cooperativa Green Alliance",
};

// Nueva ruta del inicio del asociado (reemplaza a /dashboard, que queda intacta por ahora).
export default async function CuentaPage({ searchParams }: PageProps<"/cuenta">) {
  // TODO(funcionalidad): ruta protegida (sin sesión → /ingresar; agregar /cuenta al matcher de proxy.ts).
  // Cargar nombre (perfiles), última solicitud (solicitudes_credito), tope (grados_credito)
  // y convenios (tabla convenios). Quitar los datos de ejemplo.

  // Solo para revisar el diseño: /cuenta?vacio=1 muestra el estado sin solicitudes.
  // TODO(funcionalidad): quitar este parámetro cuando la solicitud venga de Supabase
  // (sin filas → `solicitud={null}`).
  const { vacio } = await searchParams;
  const mostrarVacio = vacio === "1";

  return (
    <Cuenta
      nombre={ASOCIADO_EJEMPLO.nombre}
      tope={ASOCIADO_EJEMPLO.tope}
      solicitud={mostrarVacio ? null : SOLICITUD_EJEMPLO}
      convenios={CONVENIOS_EJEMPLO}
      cedula={ASOCIADO_EJEMPLO.cedula}
      grado={ASOCIADO_EJEMPLO.grado}
      telefono={ASOCIADO_EJEMPLO.telefono}
    />
  );
}
