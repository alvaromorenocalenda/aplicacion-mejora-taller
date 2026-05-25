"use client"

import dynamic from "next/dynamic"

const CalendarioCitas = dynamic(() => import("@/components/CalendarioCitas"), {
  ssr: false,
})

export default function Page() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Calendario de Citas</h1>
      <div className="mb-4 flex gap-3 flex-wrap">
        <button
          onClick={() => window.location.href = "/calendarios"}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Volver a Calendarios
        </button>
        <button
          onClick={() => window.location.href = "/agenda-mecanicos"}
          className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800"
        >
          🔧 Agenda Mecánicos
        </button>
      </div>
      <CalendarioCitas />
    </main>
  )
}
