"use server";

import { z } from "zod";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

const esquema = z.object({ id: z.uuid(), tipo: z.enum(["vista", "whatsapp"]) });

/**
 * Registra una vista o un clic en WhatsApp de una publicación
 * (registrar_evento_publicacion: solo asociados activos y publicaciones
 * vigentes; tope de 20 por asociado y día). Nunca falla hacia la pantalla.
 */
export async function registrarEventoBeneficio(id: string, tipo: "vista" | "whatsapp"): Promise<void> {
  const datos = esquema.safeParse({ id, tipo });
  if (!datos.success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.rpc("registrar_evento_publicacion", { p_publicacion: datos.data.id, p_tipo: datos.data.tipo });
  if (error) registrar("warn", { evento: "beneficio_evento_fallo", tipo, codigo: error.code, mensaje: error.message });
}
