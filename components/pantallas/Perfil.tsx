import { BarraInferiorCuenta } from "@/components/pantallas/BarraInferiorCuenta";
import { EncabezadoCuenta } from "@/components/pantallas/EncabezadoCuenta";
import { PerfilCuenta, type PerfilCuentaProps } from "@/components/pantallas/cuenta/PerfilCuenta";

export type PerfilProps = PerfilCuentaProps & {
  /** Server Action de «Salir» (signOut → /ingresar). */
  accionSalir?: (formData: FormData) => void;
};

/**
 * Pantalla «Perfil» del asociado (/cuenta/perfil, pieza 3k): pestaña propia con su `h1`,
 * que absorbe «Mis datos». Misma cáscara que /cuenta (encabezado píldora en escritorio,
 * barra inferior de 4 pestañas en celular). El sorteo vive solo en Inicio.
 */
export function Perfil({ accionSalir, ...perfil }: PerfilProps) {
  return (
    <div className="min-h-dvh bg-ga-fondo-suave pb-28 lg:pb-0">
      <EncabezadoCuenta nombre={perfil.nombre} seccion="perfil" accionSalir={accionSalir} />

      <main className="flex flex-col gap-4 px-5 pb-6 pt-5 md:mx-auto md:max-w-2xl lg:max-w-none lg:gap-6 lg:px-14 lg:py-10">
        <h1 className="m-0 font-display text-30 font-extrabold tracking-titulo text-ga-navy lg:text-44">Tu perfil</h1>
        <PerfilCuenta {...perfil} />
      </main>

      <BarraInferiorCuenta activa="perfil" />
    </div>
  );
}
