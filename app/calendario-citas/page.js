"use client"

import dynamic from "next/dynamic"

const CalendarioCitas = dynamic(() => import("@/components/CalendarioCitas"), {
  ssr: false,
})

export default function Page() {
  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Calendario de Citas</h1>
      <CalendarioCitas />
    </main>
  )
}
