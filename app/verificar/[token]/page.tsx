import type { Metadata } from "next";
import Image from "next/image";
import { esTokenCarne, vistaVerificacion } from "@/lib/carne";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Verificación de carné · Cooperativa Green Alliance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Verificación pública del carné (a donde lleva el QR). Sin sesión. Solo
 * nombre, grado, institución y estado, vía la RPC verificar_carne. Token con
 * formato raro, inexistente o regenerado: la MISMA pantalla «Carné no válido».
 */
export default async function VerificarCarnePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let datos = null;
  if (esTokenCarne(token)) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("verificar_carne", { p_token: token.toLowerCase() });
    if (error) registrar("error", { evento: "verificar_carne_fallo", codigo: error.code, mensaje: error.message });
    datos = vistaVerificacion(data);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center gap-5 px-5 py-10">
      <Image
        src="/logos/vector/green-alliance-wordmark.svg"
        alt="Cooperativa Green Alliance"
        width={4118}
        height={669}
        className="h-[34px] w-auto"
      />
      {datos ? (
        <section aria-labelledby="titulo-verif" className="flex w-full flex-col gap-3 rounded-28 bg-white p-6">
          <h1 id="titulo-verif" className="m-0 font-display text-24 font-extrabold text-ga-verde-oscuro">
            Afiliado verificado
          </h1>
          <strong className="break-words font-display text-22 font-extrabold text-ga-navy">{datos.nombre}</strong>
          <dl className="m-0 grid grid-cols-1 gap-3 text-15">
            <div>
              <dt className="text-12 text-ga-texto-2">Grado</dt>
              <dd className="m-0 font-bold text-ga-navy">{datos.grado}</dd>
            </div>
            {datos.institucion ? (
              <div>
                <dt className="text-12 text-ga-texto-2">Institución</dt>
                <dd className="m-0 font-bold text-ga-navy">{datos.institucion}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-12 text-ga-texto-2">Estado</dt>
              <dd className="m-0 font-bold text-ga-navy">{datos.activo ? "Asociado activo" : "Asociado inactivo"}</dd>
            </div>
          </dl>
          <p className="m-0 text-13 text-ga-texto-2">
            Este carné no es un documento de identidad. Pide también el documento de la persona.
          </p>
        </section>
      ) : (
        <section aria-labelledby="titulo-verif" className="flex w-full flex-col gap-2 rounded-28 bg-white p-6">
          <h1 id="titulo-verif" className="m-0 font-display text-24 font-extrabold text-ga-navy">
            Carné no válido
          </h1>
          <p className="m-0 text-15 text-ga-texto-2">
            No pudimos verificar este código. Puede haber sido regenerado. Pide al asociado que te muestre el carné
            actualizado desde su cuenta.
          </p>
        </section>
      )}
    </main>
  );
}
