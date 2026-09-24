import { redirect } from "next/navigation";
import { exigirAdmin } from "@/lib/admin/servidor";

/** /admin sin sección: verifica el rol y manda a la primera pestaña. */
export default async function AdminPage() {
  await exigirAdmin();
  redirect("/admin/afiliaciones");
}
