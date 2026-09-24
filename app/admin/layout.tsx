import type { ReactNode } from "react";

/**
 * Sin lógica propia: cada página de /admin llama a `exigirAdmin()` y arma su
 * encabezado con `<AdminShell seccion="...">` (components/admin/AdminShell.tsx).
 * Así la sección activa del encabezado no depende de adivinar la ruta actual.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
