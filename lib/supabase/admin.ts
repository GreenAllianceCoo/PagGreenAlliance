import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SERVICE ROLE: salta RLS. Solo para el servidor (Server Actions,
 * Route Handlers, Server Components) y solo para lo que la spec pide:
 *  - correo_por_cedula() en el ingreso con código,
 *  - insertar en solicitudes_afiliacion,
 *  - leer los grados para el formulario público de afiliación,
 *  - registrar_intento() (límite de frecuencia).
 * `import "server-only"` hace fallar el build si alguien lo importa en el cliente.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor.");
  }
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Cliente anónimo SIN sesión ni cookies. Se usa para enviar el código
 * (signInWithOtp) sin dejar cookies de PKCE en el navegador: el paso 2
 * verifica con el token de 6 dígitos, no con un enlace.
 */
export function crearClienteAnonimoSinSesion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !llave) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return createClient(url, llave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
