import Link from "next/link";

const SERVICIOS = [
  {
    titulo: "Microcreditos 50% / 100%",
    descripcion:
      "Creditos aprobados en minutos, ajustados al grado y capacidad de pago de cada asociado.",
  },
  {
    titulo: "Asesoria financiera",
    descripcion:
      "Orientacion financiera estrategica para recuperar tu estabilidad economica.",
  },
  {
    titulo: "Acompanamiento juridico",
    descripcion: "Respaldo juridico integral durante todo el proceso.",
  },
  {
    titulo: "Convenios y beneficios",
    descripcion:
      "Red de empresas aliadas en hoteleria, salud y tecnologia con condiciones preferenciales.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 pb-16 text-center">
      <section className="w-full flex flex-col items-center gap-6 pt-16 pb-12">
        <div className="w-16 h-16 rounded-full bg-navy flex items-center justify-center">
          <span className="text-white font-bold text-xl">GA</span>
        </div>
        <h1 className="text-3xl font-bold text-navy max-w-lg">
          Cooperativa Green Alliance
        </h1>
        <p className="text-gray-600 max-w-md">
          Escudo y lazo solidario para la familia policial: microcreditos de
          facil acceso, orientacion financiera estrategica y acompanamiento
          juridico integral.
        </p>
        <Link
          href="/login"
          className="bg-green text-white px-6 py-3 rounded-lg font-semibold"
        >
          Iniciar sesion
        </Link>
      </section>

      <section className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 py-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-left">
          <h2 className="text-lg font-bold text-navy mb-2">Nuestra mision</h2>
          <p className="text-sm text-gray-600">
            Ser escudo y lazo solidario para la familia policial es nuestro
            proposito, y lo materializamos con microcreditos de facil acceso,
            orientacion financiera estrategica y acompanamiento juridico
            integral que enaltecen su vocacion de servicio y favorecen su
            crecimiento economico.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-left">
          <h2 className="text-lg font-bold text-navy mb-2">Nuestra vision</h2>
          <p className="text-sm text-gray-600">
            Aspiramos a liderar el cooperativismo colombiano por identidad y
            arraigo institucional, sustentados en una organizacion moderna, de
            proyeccion internacional, capaz de asegurar el bienestar
            financiero de nuestros hombres y mujeres.
          </p>
        </div>
      </section>

      <section className="w-full max-w-2xl py-6">
        <h2 className="text-lg font-bold text-navy mb-1">Nuestros servicios</h2>
        <p className="text-sm text-gray-500 mb-6">
          Todo lo que la cooperativa pone al servicio de cada asociado
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SERVICIOS.map((servicio) => (
            <div
              key={servicio.titulo}
              className="bg-surface-muted rounded-xl p-5 text-left"
            >
              <p className="font-bold text-navy mb-1">{servicio.titulo}</p>
              <p className="text-sm text-gray-600">{servicio.descripcion}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
