import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center">
        <span className="text-white font-bold text-xl">GA</span>
      </div>
      <h1 className="text-3xl font-bold text-navy">Cooperativa Green Alliance</h1>
      <p className="text-gray-600 max-w-md">
        Escudo y proteccion financiera para nuestros asociados. Landing pendiente
        de contenido final (mision, vision, servicios).
      </p>
      <Link
        href="/login"
        className="bg-green text-white px-6 py-3 rounded-lg font-semibold"
      >
        Iniciar sesion
      </Link>
    </main>
  );
}
