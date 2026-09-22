"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase Auth requiere un correo. Los asociados inician sesion con su
// cedula, asi que internamente la mapeamos a un correo sintetico:
// {cedula}@asociados.greenallianceco.com — invisible para el usuario.
function cedulaAEmail(cedula: string) {
  return `${cedula.trim()}@asociados.greenallianceco.com`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [cedula, setCedula] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cedulaAEmail(cedula),
      password,
    });

    setLoading(false);

    if (error) {
      setError("Cedula o contrasena incorrecta.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center mb-4">
          <span className="text-white font-bold">GA</span>
        </div>
        <p className="text-sm font-bold text-navy tracking-wide mb-8">
          COOPERATIVA GREEN ALLIANCE
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesion</h1>

          <div>
            <label className="text-sm font-semibold text-gray-600">Usuario</label>
            <input
              type="text"
              required
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Numero de cedula"
              className="w-full h-12 border border-gray-300 rounded-lg px-4 mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-600">Contrasena</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              className="w-full h-12 border border-gray-300 rounded-lg px-4 mt-1"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-13 py-3 bg-green text-white rounded-lg font-bold disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
