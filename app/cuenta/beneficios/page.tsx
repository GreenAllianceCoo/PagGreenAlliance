import type { Metadata } from "next";
import Link from "next/link";
import { cerrarSesion } from "@/app/cuenta/actions";
import { TarjetaPublicacion } from "@/components/convenio/TarjetaPublicacion";
import { BarraInferiorCuenta } from "@/components/pantallas/BarraInferiorCuenta";
import { EncabezadoCuenta } from "@/components/pantallas/EncabezadoCuenta";
import { esquemaFiltrosBeneficios, filtrarBeneficios, opcionesDeFiltros, TODO_EL_PAIS } from "@/lib/beneficios/beneficios";
import { cargarBeneficios, sesionBeneficios, type Beneficio } from "@/lib/beneficios/servidor";

export const metadata: Metadata = { title: "Beneficios · Cooperativa Green Alliance" };

const CLASE_CONTROL =
  "h-12 w-full min-w-0 rounded-12 bg-white px-3.5 text-16 text-ga-texto shadow-[inset_0_0_0_1px_var(--ga-linea)] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--ga-verde)]";
const CLASE_ETIQUETA = "text-14 font-semibold text-ga-texto-2";

type Busqueda = { aliado?: string; categoria?: string; ciudad?: string };

/**
 * Beneficios (docs/spec-convenios.md §B5): promociones y catálogos activos de
 * los convenios, los más recientes primero, con filtros por aliado, categoría
 * y ciudad. Solo con sesión; RLS deja ver solo lo vigente a asociados activos.
 */
export default async function BeneficiosPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  const { supabase, nombre, esAsociado } = await sesionBeneficios();
  const filtros = esquemaFiltrosBeneficios.parse(await searchParams);
  const { beneficios, error } = esAsociado ? await cargarBeneficios(supabase) : { beneficios: [] as Beneficio[], error: false };
  const opciones = opcionesDeFiltros(beneficios);
  const lista = filtrarBeneficios(beneficios, filtros);
  const hayFiltros = Boolean(filtros.aliado || filtros.categoria || filtros.ciudad);

  return (
    <div className="min-h-dvh bg-ga-fondo-suave pb-28 lg:pb-0">
      <EncabezadoCuenta nombre={nombre} seccion="beneficios" accionSalir={cerrarSesion} />
      <main className="flex flex-col gap-5 px-5 pb-6 pt-5 md:mx-auto md:max-w-2xl lg:max-w-6xl lg:gap-6 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-30 font-extrabold text-ga-navy lg:text-44">Beneficios</h1>
          <p className="m-0 max-w-[640px] text-15 leading-150 text-ga-texto-2 lg:text-16">
            Promociones y catálogos que publican las empresas en convenio para los asociados. Escríbeles por WhatsApp desde cada
            publicación.
          </p>
        </div>

        {!esAsociado ? (
          <p className="m-0 rounded-20 bg-white p-5 text-15 text-ga-texto-2">Los beneficios son solo para asociados activos.</p>
        ) : error ? (
          <p role="alert" className="m-0 rounded-20 bg-white p-5 text-15 font-semibold text-ga-error-texto">
            No pudimos cargar los beneficios. Recarga la página.
          </p>
        ) : beneficios.length === 0 ? (
          <p className="m-0 rounded-20 bg-white p-5 text-15 text-ga-texto-2">
            Todavía no hay promociones publicadas. Mientras tanto, mira{" "}
            <Link href="/cuenta#convenios" className="font-semibold text-ga-verde">
              tus convenios
            </Link>
            .
          </p>
        ) : (
          <>
            <form
              role="search"
              aria-label="Filtrar beneficios"
              className="grid grid-cols-1 gap-3 rounded-20 bg-white p-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end lg:p-5"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ben-aliado" className={CLASE_ETIQUETA}>
                  Aliado
                </label>
                <select id="ben-aliado" name="aliado" defaultValue={filtros.aliado ?? ""} className={CLASE_CONTROL}>
                  <option value="">Todos</option>
                  {opciones.aliados.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ben-categoria" className={CLASE_ETIQUETA}>
                  Categoría
                </label>
                <select id="ben-categoria" name="categoria" defaultValue={filtros.categoria ?? ""} className={CLASE_CONTROL}>
                  <option value="">Todas</option>
                  {opciones.categorias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ben-ciudad" className={CLASE_ETIQUETA}>
                  Ciudad
                </label>
                <select id="ben-ciudad" name="ciudad" defaultValue={filtros.ciudad ?? ""} className={CLASE_CONTROL}>
                  <option value="">Todas</option>
                  {opciones.ciudades.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 sm:col-span-3 lg:col-span-1">
                <button
                  type="submit"
                  className="flex h-12 flex-1 items-center justify-center rounded-full bg-ga-verde px-7 text-15 font-extrabold text-white lg:flex-none"
                >
                  Filtrar
                </button>
                {hayFiltros ? (
                  <Link
                    href="/cuenta/beneficios"
                    className="flex h-12 items-center justify-center rounded-full px-5 text-15 font-bold text-ga-navy no-underline shadow-[inset_0_0_0_1px_var(--ga-linea)] hover:bg-ga-fondo-suave"
                  >
                    Quitar filtros
                  </Link>
                ) : null}
              </div>
            </form>
            {filtros.ciudad ? (
              <p className="m-0 -mt-2 text-14 text-ga-texto-3">Incluye los convenios de «{TODO_EL_PAIS}».</p>
            ) : null}

            {lista.length === 0 ? (
              <p className="m-0 rounded-20 bg-white p-5 text-15 text-ga-texto-2">No hay beneficios con esos filtros.</p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="beneficios">
                {lista.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/cuenta/beneficios/${b.id}`}
                      className="block h-full rounded-20 text-inherit no-underline transition-shadow hover:shadow-[0_0_0_2px_var(--ga-verde)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ga-verde"
                    >
                      <TarjetaPublicacion
                        datos={{
                          tipo: b.tipo,
                          titulo: b.titulo,
                          descripcion: b.descripcion,
                          beneficio: b.beneficio,
                          terminaEl: b.terminaEl,
                          portada: b.portada,
                          totalImagenes: b.imagenes.length,
                          esPdf: Boolean(b.pdfPath),
                          convenio: { nombre: b.convenioNombre, logoUrl: b.convenioLogoUrl },
                          nuevo: b.nuevo,
                        }}
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <BarraInferiorCuenta activa={null} />
    </div>
  );
}
