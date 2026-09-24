"use client";

import { useFormStatus } from "react-dom";
import { Button, type VarianteBoton } from "@/components/ui/Button";

type BotonEnviarProps = {
  children: React.ReactNode;
  textoCargando: string;
  variante?: VarianteBoton;
  className?: string;
};

/**
 * Botón de envío que se deshabilita solo mientras su <form> está enviando
 * (useFormStatus), para que ningún botón de /admin permita doble clic.
 */
export function BotonEnviar({ children, textoCargando, variante = "primario", className }: BotonEnviarProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante={variante} cargando={pending} textoCargando={textoCargando} className={className}>
      {children}
    </Button>
  );
}
