"use client"

import { useEffect, useState } from "react"
import { Calendar, momentLocalizer } from "react-big-calendar"
import moment from "moment"
import "moment/locale/es"
import "react-big-calendar/lib/css/react-big-calendar.css"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../lib/firebase"  // si estás en /components

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

export default function CalendarioCitas() {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
  async function cargarEventos() {
    const col = collection(db, "cuestionarios_cliente");
    const snap = await getDocs(col);
    const hoy = new Date();

    const nuevosEventos = snap.docs
      .map((doc) => {
        const datos = doc.data();
        const { datos: d, estadoPresupuesto } = datos;

        // 🔴 Filtramos si está FINALIZADO o DENEGADO
        if (estadoPresupuesto && (estadoPresupuesto === "FINALIZADO" || estadoPresupuesto === "DENEGADO")) {
          return null;
        }

        const eventos = [];

        if (d.fechaCita) {
          eventos.push({
            title: `📅 Cita - Mat: ${d.matricula} | OR: ${d.numeroOR}`,
            start: new Date(d.fechaCita),
            end: new Date(d.fechaCita),
            tipo: "cita",
            tooltip: `📅 Cita para el vehículo con matrícula ${d.matricula} y orden ${d.numeroOR}`
          });
        }

        eventos.push({
          title: `📝 Alta - Mat: ${d.matricula} | OR: ${d.numeroOR}`,
          start: datos.creadoEn?.toDate?.() || hoy,
          end: datos.creadoEn?.toDate?.() || hoy,
          tipo: "alta",
          tooltip: `📝 Alta de vehículo con matrícula ${d.matricula} y orden ${d.numeroOR}`
        });

        if (d.fechaSalida) {
          const fechaSalida = new Date(d.fechaSalida);
          const vencido = fechaSalida < hoy;
          eventos.push({
            title: `🚗 Entrega - Mat: ${d.matricula} | OR: ${d.numeroOR} (${vencido ? "vencida" : "pendiente"})`,
            start: fechaSalida,
            end: fechaSalida,
            tipo: "entrega",
             tooltip: `🚗 Entrega programada para el vehículo con matrícula ${d.matricula} y orden ${d.numeroOR}${vencido ? " (vencida)" : ""}`,
            entregado: false,
            vencido
          });
        }

        return eventos;
      })
      .flat()
      .filter(Boolean);

    setEventos(nuevosEventos);
  }

  cargarEventos();
}, []);

  return (
    <div style={{ height: "100%", padding: "1rem" }}>
      <div className="mb-4">
        <button
          onClick={() => window.location.href = "/calendarios"}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          ⬅ Volver a Calendarios
        </button>
      </div>

      <Calendar
        localizer={localizer}
        events={eventos}
        startAccessor="start"
        endAccessor="end"
        messages={mensajesES}
        style={{ height: "600px" }}
        eventPropGetter={(event) => {
          let bg = "#f472b6"
          if (event.tipo === "alta") bg = "#d1d5db"
          if (event.tipo === "entrega") {
            if (event.entregado) bg = "#4ade80"
            else if (event.vencido) bg = "#dc2626"
            else bg = "#60a5fa"
          }

          return {
            style: {
              backgroundColor: bg,
              color: "white",
              borderRadius: "6px",
              padding: "4px",
              fontWeight: "bold"
            }
          }
        }}
      />

      <div className="mt-6 grid gap-2 text-sm text-gray-700">
        <div><span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: "#f472b6" }}></span>📅 Cita</div>
        <div><span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: "#d1d5db" }}></span>📝 Alta</div>
        <div><span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: "#60a5fa" }}></span>🚗 Entrega pendiente</div>
        <div><span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: "#dc2626" }}></span>🔥 Entrega vencida</div>
        <div><span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: "#4ade80" }}></span>✅ Entrega completada</div>
      </div>
    </div>
  )
}
