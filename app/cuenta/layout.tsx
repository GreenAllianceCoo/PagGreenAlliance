import { AvisosAlEntrar, type AvisoPendiente } from "@/components/cuenta/AvisosAlEntrar";
import { BotonWhatsappFlotante } from "@/components/ui/BotonWhatsappFlotante";
import { createClient } from "@/lib/supabase/server";

/**
 * Común a /cuenta: el botón flotante de WhatsApp con el nombre del asociado y
 * los avisos que publicó la cooperativa (mis_avisos_pendientes, solo los que
 * le tocan y aún no ha visto). Solo se lee lo del propio usuario (RLS / RPC);
 * cada página sigue haciendo sus propias comprobaciones de sesión y de cuenta activa.
 */
export default async function CuentaLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let nombre: string | null = null;
  let avisos: AvisoPendiente[] = [];
  if (user) {
    const [{ data: perfil }, { data: pendientes }] = await Promise.all([
      supabase.from("perfiles").select("nombre_completo").eq("id", user.id).maybeSingle(),
      supabase.rpc("mis_avisos_pendientes"),
    ]);
    nombre = (perfil?.nombre_completo as string | undefined) ?? null;
    avisos = ((pendientes ?? []) as { id: string; titulo: string; mensaje: string }[]).map((a) => ({
      id: a.id,
      titulo: a.titulo,
      mensaje: a.mensaje,
    }));
  }
  return (
    <>
      {children}
      <BotonWhatsappFlotante nombre={nombre} conNombre />
      {avisos.length > 0 ? <AvisosAlEntrar avisos={avisos} /> : null}
    </>
  );
}
