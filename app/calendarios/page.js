"use client"

import { useRouter } from "next/navigation"

export default function CalendariosPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Calendarios</h1>
            <p className="text-gray-600 mt-1">Accede al calendario de citas y a la planificacion de mecanicos.</p>
          </div>
          <button onClick={() => router.push("/dashboard")} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 w-fit">Volver al Dashboard</button>
        </header>
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button onClick={() => router.push("/calendario-citas")} className="text-left bg-white border border-gray-200 rounded-xl shadow p-6 hover:shadow-lg hover:border-pink-300 transition">
            <div className="text-4xl mb-3">📅</div>
            <h2 className="text-xl font-bold text-gray-900">Calendario de Citas</h2>
            <p className="text-gray-600 mt-2">Consulta las citas, altas y fechas previstas de entrega de los vehiculos.</p>
          </button>
          <button onClick={() => router.push("/agenda-mecanicos")} className="text-left bg-white border border-gray-200 rounded-xl shadow p-6 hover:shadow-lg hover:border-blue-300 transition">
            <div className="text-4xl mb-3">🔧</div>
            <h2 className="text-xl font-bold text-gray-900">Agenda Mecanicos</h2>
            <p className="text-gray-600 mt-2">Añade mecanicos y asigna vehiculos con duracion estimada de reparacion.</p>
          </button>
        </section>
      </div>
    </main>
  )
}
