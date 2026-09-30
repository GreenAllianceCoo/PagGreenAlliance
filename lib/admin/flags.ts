/**
 * Bandera de una función que depende de una migración PROPUESTA pero SIN
 * APLICAR: supabase/migrations/20260925200200_historial_y_notas_internas.sql
 * (tabla `historial_solicitudes`, función `agregar_nota_solicitud`).
 *
 * Mientras siga sin aplicar, esa tabla y esa función no existen en la base:
 * el textarea de «Nota interna · solo la ve el equipo» del panel de admin
 * (créditos y afiliaciones) se mantiene OCULTO en vez de mostrarse sin
 * guardar nada — un campo visible que no persiste podría hacerle perder al
 * admin una nota que cree que ya quedó guardada.
 *
 * Sin uso de `NEXT_PUBLIC_*`: es una constante de compilación, no una
 * variable de entorno; no hay ningún dato sensible aquí.
 *
 * TODO(backend): cuando Sebas aplique esa migración, cambiar esto a `true`
 * y conectar los textarea a una Server Action nueva que llame a
 * `agregar_nota_solicitud` (fuera del alcance de este agente: el diseño no
 * pide todavía cómo se ve el historial de notas ya guardadas).
 */
export const HISTORIAL_NOTAS_INTERNAS_HABILITADO = false;
