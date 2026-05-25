"use client"

import dynamic from "next/dynamic"

const CalendarioCitas = dynamic(() => import("@/components/CalendarioCitas"), {
  ssr: false,
})

export default function Page() {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-blue-700">Calendarios</p>
              <h1 className="mt-1 text-3xl font-black text-slate-950">Calendario de Citas</h1>
              <p className="mt-1 text-slate-600">Vista general de citas, altas y entregas previstas del taller.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => window.location.href = "/calendarios"}
                className="rounded-xl bg-slate-700 px-4 py-3 font-bold text-white hover:bg-slate-800"
              >
                ← Volver a Calendarios
              </button>
              <button
                onClick={() => window.location.href = "/agenda-mecanicos"}
                className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white hover:bg-blue-800"
              >
                🔧 Agenda Mecánicos
              </button>
            </div>
          </div>
        </header>

        <CalendarioCitas />
      </div>
    </main>
  )
}
