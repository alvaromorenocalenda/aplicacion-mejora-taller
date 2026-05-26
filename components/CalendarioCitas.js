"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, momentLocalizer, Views } from "react-big-calendar"
import moment from "moment"
import "moment/locale/es"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../lib/firebase"

moment.locale("es")
const localizer = momentLocalizer(moment)

const mensajesES = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "No hay eventos en este rango"
}

const tipoConfig = {
  cita: { label: "Citas", icon: "📅", color: "#ec4899", bg: "bg-pink-50", text: "text-pink-800", ring: "ring-pink-100", hora: 9 },
  alta: { label: "Altas", icon: "📝", color: "#64748b", bg: "bg-slate-50", text: "text-slate-800", ring: "ring-slate-200", hora: 11 },
  entregaPendiente: { label: "Entregas pendientes", icon: "🚗", color: "#2563eb", bg: "bg-blue-50", text: "text-blue-800", ring: "ring-blue-100", hora: 17 },
  entregaVencida: { label: "Entregas vencidas", icon: "🔥", color: "#dc2626", bg: "bg-red-50", text: "text-red-800", ring: "ring-red-100", hora: 17 },
  entregaCompletada: { label: "Entregas completadas", icon: "✅", color: "#22c55e", bg: "bg-green-50", text: "text-green-800", ring: "ring-green-100", hora: 17 },
}

function fechaCorta(v) {
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) return "Sin fecha"
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function diaKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function parseFechaLocal(valor, horaDefecto = 9) {
  if (!valor) return null
  if (valor?.toDate?.()) return valor.toDate()
  if (valor instanceof Date) return valor

  const texto = String(valor)
  const soloFecha = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (soloFecha) {
    const [, y, m, d] = soloFecha
    return new Date(Number(y), Number(m) - 1, Number(d), horaDefecto, 0, 0, 0)
  }

  const fecha = new Date(texto)
  if (Number.isNaN(fecha.getTime())) return null

  // Algunos campos guardados como fecha pura aparecen a las 02:00 por zona horaria.
  // Para que no se amontonen de madrugada, los llevamos a una hora lógica del taller.
  if (fecha.getHours() >= 0 && fecha.getHours() <= 3 && fecha.getMinutes() === 0) {
    fecha.setHours(horaDefecto, 0, 0, 0)
  }

  return fecha
}

function repartirEventosDelMismoDia(eventos) {
  const grupos = new Map()
  eventos.forEach((ev) => {
    const key = `${diaKey(ev.start)}-${ev.tipo}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(ev)
  })

  grupos.forEach((lista) => {
    lista
      .sort((a, b) => (a.start?.getTime?.() || 0) - (b.start?.getTime?.() || 0))
      .forEach((ev, index) => {
        const cfg = tipoConfig[ev.tipo] || tipoConfig.cita
        const d = new Date(ev.start)

        // Si hay muchos eventos el mismo día/tipo, los repartimos cada 20 minutos.
        // Así en día/semana no salen todos pegados en la misma línea.
        const baseMinutos = (cfg.hora || 9) * 60
        const offset = index * 20
        const minutos = Math.min(baseMinutos + offset, 19 * 60)
        d.setHours(Math.floor(minutos / 60), minutos % 60, 0, 0)
        ev.start = d
        ev.end = new Date(d.getTime() + 30 * 60000)
      })
  })

  return eventos
}

function EventCard({ event }) {
  const cfg = tipoConfig[event.tipo] || tipoConfig.cita
  return (
    <div title={event.tooltip} className="cal-event-inner" style={{ backgroundColor: cfg.color }}>
      <span className="cal-event-icon">{event.icon}</span>
      <span className="cal-event-text">{event.shortTitle}</span>
    </div>
  )
}

export default function CalendarioCitas() {
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState("todos")
  const [eventoActivo, setEventoActivo] = useState(null)
  const [vista, setVista] = useState(Views.MONTH)

  useEffect(() => {
    async function cargarEventos() {
      setCargando(true)
      const col = collection(db, "cuestionarios_cliente")
      const snap = await getDocs(col)
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      const nuevosEventos = snap.docs
        .map((doc) => {
          const datos = doc.data()
          const d = datos.datos || {}
          const estadoPresupuesto = datos.estadoPresupuesto

          if (estadoPresupuesto && (estadoPresupuesto === "FINALIZADO" || estadoPresupuesto === "DENEGADO")) return null

          const matricula = d.matricula || "Sin matrícula"
          const numeroOR = d.numeroOR || "Sin OR"
          const cliente = d.nombreCliente || d.nombre || "Sin cliente"
          const marcaModelo = d.marcaModelo || d.modelo || ""
          const eventos = []

          if (d.fechaCita) {
            const start = parseFechaLocal(d.fechaCita, tipoConfig.cita.hora)
            if (start) eventos.push({
              id: `${doc.id}-cita`,
              cuestionarioId: doc.id,
              title: `📅 Cita - ${matricula} | OR ${numeroOR}`,
              shortTitle: `${matricula} · OR ${numeroOR}`,
              start,
              end: new Date(start.getTime() + 30 * 60000),
              tipo: "cita",
              icon: "📅",
              matricula,
              numeroOR,
              cliente,
              marcaModelo,
              tooltip: `Cita: ${matricula} · OR ${numeroOR} · ${cliente}`
            })
          }

          const alta = datos.creadoEn?.toDate?.() || null
          if (alta) {
            eventos.push({
              id: `${doc.id}-alta`,
              cuestionarioId: doc.id,
              title: `📝 Alta - ${matricula} | OR ${numeroOR}`,
              shortTitle: `${matricula} · OR ${numeroOR}`,
              start: alta,
              end: new Date(alta.getTime() + 30 * 60000),
              tipo: "alta",
              icon: "📝",
              matricula,
              numeroOR,
              cliente,
              marcaModelo,
              tooltip: `Alta: ${matricula} · OR ${numeroOR} · ${cliente}`
            })
          }

          if (d.fechaSalida) {
            const fechaSalida = parseFechaLocal(d.fechaSalida, tipoConfig.entregaPendiente.hora)
            if (fechaSalida) {
              const fechaSalidaDia = new Date(fechaSalida)
              fechaSalidaDia.setHours(0, 0, 0, 0)
              const vencido = fechaSalidaDia < hoy
              const tipo = vencido ? "entregaVencida" : "entregaPendiente"
              eventos.push({
                id: `${doc.id}-entrega`,
                cuestionarioId: doc.id,
                title: `🚗 Entrega - ${matricula} | OR ${numeroOR}`,
                shortTitle: `${matricula} · OR ${numeroOR}`,
                start: fechaSalida,
                end: new Date(fechaSalida.getTime() + 30 * 60000),
                tipo,
                icon: vencido ? "🔥" : "🚗",
                entregado: false,
                vencido,
                matricula,
                numeroOR,
                cliente,
                marcaModelo,
                tooltip: `Entrega ${vencido ? "vencida" : "pendiente"}: ${matricula} · OR ${numeroOR} · ${cliente}`
              })
            }
          }

          return eventos
        })
        .flat()
        .filter(Boolean)

      setEventos(repartirEventosDelMismoDia(nuevosEventos))
      setCargando(false)
    }

    cargarEventos()
  }, [])

  const eventosFiltrados = useMemo(() => {
    if (filtro === "todos") return eventos
    return eventos.filter((e) => e.tipo === filtro)
  }, [eventos, filtro])

  const resumen = useMemo(() => {
    const base = { cita: 0, alta: 0, entregaPendiente: 0, entregaVencida: 0, entregaCompletada: 0 }
    eventos.forEach((e) => { if (base[e.tipo] !== undefined) base[e.tipo] += 1 })
    return base
  }, [eventos])

  return (
    <section className="space-y-5">
      <style jsx global>{`
        .rbc-calendar {
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(15,23,42,0.08);
          border-radius: 24px;
          box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
          padding: 16px;
          backdrop-filter: blur(14px);
        }
        .rbc-toolbar {
          gap: 12px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .rbc-toolbar-label {
          font-weight: 900;
          color: #0f172a;
          text-transform: capitalize;
          font-size: 1.1rem;
        }
        .rbc-btn-group {
          overflow: hidden;
          border: 1px solid rgba(15,23,42,0.10);
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(15,23,42,0.06);
        }
        .rbc-btn-group button {
          border: 0 !important;
          color: #334155;
          padding: 9px 14px;
          font-weight: 800;
          background: white;
        }
        .rbc-btn-group button:hover,
        .rbc-btn-group button.rbc-active {
          background: #2563eb !important;
          color: white !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .rbc-month-view,
        .rbc-time-view,
        .rbc-agenda-view {
          border: 1px solid rgba(148,163,184,0.32);
          border-radius: 18px;
          overflow: hidden;
          background: #f8fafc;
        }
        .rbc-time-view { min-width: 920px; }
        .rbc-time-content { scroll-behavior: smooth; }
        .rbc-timeslot-group { min-height: 52px; }
        .rbc-header {
          padding: 10px 6px;
          background: linear-gradient(180deg, #f8fafc, #eef4fb);
          color: #1e293b;
          font-weight: 900;
          border-color: rgba(148,163,184,0.32) !important;
        }
        .rbc-date-cell {
          padding: 6px 8px;
          font-weight: 800;
          color: #64748b;
        }
        .rbc-off-range-bg { background: #f1f5f9; }
        .rbc-today { background: rgba(37, 99, 235, 0.08) !important; }
        .rbc-event {
          border: 0 !important;
          border-radius: 10px !important;
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .cal-event-inner {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
          width: 100%;
          height: 100%;
          color: #fff;
          border-radius: 10px;
          padding: 4px 7px;
          font-weight: 900;
          font-size: 12px;
          box-shadow: 0 8px 18px rgba(15,23,42,0.16);
        }
        .cal-event-icon { flex: 0 0 auto; }
        .cal-event-text {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .rbc-show-more {
          color: #2563eb;
          font-weight: 900;
          font-size: 12px;
        }
        .rbc-agenda-view table.rbc-agenda-table {
          border-collapse: separate;
          border-spacing: 0;
          background: white;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr,
        .rbc-agenda-view table.rbc-agenda-table tbody > tr > td {
          background: #fff !important;
          color: #0f172a !important;
        }
        .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(even),
        .rbc-agenda-view table.rbc-agenda-table tbody > tr:nth-child(even) > td {
          background: #f8fafc !important;
        }
        .rbc-agenda-view .rbc-agenda-event-cell .cal-event-inner {
          display: inline-flex;
          width: auto;
          max-width: 100%;
          min-height: 30px;
        }
        @media (max-width: 768px) {
          .rbc-calendar { padding: 10px; border-radius: 18px; overflow-x: auto; }
          .rbc-toolbar { align-items: stretch; }
          .rbc-toolbar .rbc-btn-group { display: grid; grid-auto-flow: column; overflow-x: auto; }
          .rbc-toolbar-label { order: -1; width: 100%; text-align: center; }
          .cal-event-inner { font-size: 11px; padding: 3px 5px; }
        }
      `}</style>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Object.entries(tipoConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setFiltro(filtro === key ? "todos" : key)}
            className={`rounded-2xl p-4 text-left ring-1 transition ${cfg.bg} ${cfg.text} ${cfg.ring} ${filtro === key ? "scale-[1.02] shadow-lg" : "shadow-sm"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl">{cfg.icon}</span>
              <span className="text-2xl font-black">{resumen[key] || 0}</span>
            </div>
            <p className="mt-2 text-sm font-black">{cfg.label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 p-4 shadow backdrop-blur">
        <div>
          <h2 className="text-lg font-black text-slate-900">Planificación de citas y entregas</h2>
          <p className="text-sm text-slate-500">Ahora los eventos se reparten por horas para que no salgan todos arrejuntados.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
          <button onClick={() => setFiltro("todos")} className={`rounded-full px-3 py-2 ${filtro === "todos" ? "bg-slate-900 text-white" : "bg-slate-100"}`}>Todos</button>
          {Object.entries(tipoConfig).map(([key, cfg]) => (
            <button key={key} onClick={() => setFiltro(key)} className={`rounded-full px-3 py-2 ${filtro === key ? "text-white" : "bg-slate-100"}`} style={filtro === key ? { backgroundColor: cfg.color } : {}}>{cfg.icon} {cfg.label}</button>
          ))}
        </div>
      </div>

      {cargando ? (
        <div className="rounded-3xl bg-white/90 p-8 text-center font-bold text-slate-600 shadow">Cargando calendario…</div>
      ) : (
        <Calendar
          localizer={localizer}
          events={eventosFiltrados}
          startAccessor="start"
          endAccessor="end"
          messages={mensajesES}
          culture="es"
          popup
          view={vista}
          onView={setVista}
          defaultView={Views.MONTH}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          min={new Date(1970, 0, 1, 8, 0, 0)}
          max={new Date(1970, 0, 1, 20, 30, 0)}
          step={30}
          timeslots={2}
          components={{ event: EventCard }}
          onSelectEvent={(event) => setEventoActivo(event)}
          style={{ height: vista === Views.MONTH ? "720px" : "760px" }}
          eventPropGetter={(event) => ({ className: `cal-event cal-event-${event.tipo}` })}
        />
      )}

      {eventoActivo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl">{eventoActivo.icon}</p>
                <h3 className="mt-2 text-2xl font-black text-slate-900">{eventoActivo.matricula}</h3>
                <p className="font-bold text-slate-600">OR {eventoActivo.numeroOR}</p>
              </div>
              <button onClick={() => setEventoActivo(null)} className="rounded-xl bg-slate-100 px-3 py-2 font-black text-slate-700">✕</button>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p><strong>Cliente:</strong> {eventoActivo.cliente}</p>
              <p><strong>Vehículo:</strong> {eventoActivo.marcaModelo || "Sin modelo"}</p>
              <p><strong>Tipo:</strong> {tipoConfig[eventoActivo.tipo]?.label || eventoActivo.tipo}</p>
              <p><strong>Fecha:</strong> {fechaCorta(eventoActivo.start)}</p>
              <p><strong>Hora:</strong> {eventoActivo.start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button onClick={() => window.location.href = `/cliente-form/${encodeURIComponent(eventoActivo.cuestionarioId)}?view=true`} className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white">Ver ficha</button>
              <button onClick={() => window.location.href = `/chat-trabajo/${encodeURIComponent(eventoActivo.cuestionarioId)}`} className="rounded-xl bg-fuchsia-600 px-4 py-3 font-bold text-white">Chat</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
