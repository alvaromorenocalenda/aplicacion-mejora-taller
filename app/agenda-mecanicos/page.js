"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

function fechaInput(valor) {
  const fecha = valor?.toDate?.() ? valor.toDate() : valor ? new Date(valor) : new Date()
  if (Number.isNaN(fecha.getTime())) return ""
  const pad = (n) => String(n).padStart(2, "0")
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}T${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`
}

function fechaTexto(valor) {
  if (!valor) return "Sin fecha"
  const fecha = valor?.toDate?.() ? valor.toDate() : new Date(valor)
  if (Number.isNaN(fecha.getTime())) return "Sin fecha"
  return fecha.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function AgendaMecanicosPage() {
  const router = useRouter()
  const [mecanicos, setMecanicos] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [nombreMecanico, setNombreMecanico] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({ mecanicoId: "", vehiculoId: "", fechaInicio: fechaInput(new Date()), duracionHoras: "1", estado: "pendiente", notas: "" })

  const mecanicosActivos = useMemo(() => mecanicos.filter((m) => m.activo !== false), [mecanicos])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setMensaje("")
    try {
      const [mecSnap, vehSnap, traSnap] = await Promise.all([
        getDocs(collection(db, "mecanicos")),
        getDocs(collection(db, "cuestionarios_cliente")),
        getDocs(collection(db, "agenda_mecanicos")),
      ])

      const listaMecanicos = mecSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))

      const listaVehiculos = vehSnap.docs.map((d) => {
        const docData = d.data() || {}
        const datos = docData.datos || docData || {}
        return {
          id: d.id,
          matricula: datos.matricula || "",
          numeroOR: datos.numeroOR || "",
          cliente: datos.nombreCliente || datos.nombre || "",
          marcaModelo: datos.marcaModelo || datos.modelo || "",
          estadoPresupuesto: docData.estadoPresupuesto || datos.estadoPresupuesto || "",
        }
      }).filter((v) => {
        const estado = String(v.estadoPresupuesto || "").toUpperCase()
        return estado !== "FINALIZADO" && estado !== "DENEGADO"
      }).sort((a, b) => String(a.matricula || "").localeCompare(String(b.matricula || "")))

      const listaTrabajos = traSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const fa = a.fechaInicio?.toDate?.() ? a.fechaInicio.toDate() : new Date(a.fechaInicio || 0)
        const fb = b.fechaInicio?.toDate?.() ? b.fechaInicio.toDate() : new Date(b.fechaInicio || 0)
        return fa - fb
      })

      setMecanicos(listaMecanicos)
      setVehiculos(listaVehiculos)
      setTrabajos(listaTrabajos)
      setForm((actual) => ({ ...actual, mecanicoId: actual.mecanicoId || listaMecanicos.find((m) => m.activo !== false)?.id || "", vehiculoId: actual.vehiculoId || listaVehiculos[0]?.id || "" }))
    } catch (error) {
      console.error(error)
      setMensaje("No se ha podido cargar la agenda.")
    }
  }

  async function agregarMecanico(e) {
    e.preventDefault()
    const nombre = nombreMecanico.trim()
    if (!nombre) return
    setGuardando(true)
    try {
      await addDoc(collection(db, "mecanicos"), { nombre, activo: true, creadoEn: serverTimestamp() })
      setNombreMecanico("")
      await cargarDatos()
      setMensaje("Mecanico añadido correctamente.")
    } catch (error) {
      console.error(error)
      setMensaje("No se ha podido añadir el mecanico.")
    } finally { setGuardando(false) }
  }

  async function quitarMecanico(id) {
    if (!confirm("Quieres quitar este mecanico de la agenda?")) return
    await updateDoc(doc(db, "mecanicos", id), { activo: false, actualizadoEn: serverTimestamp() })
    await cargarDatos()
  }

  async function asignarTrabajo(e) {
    e.preventDefault()
    const mecanico = mecanicosActivos.find((m) => m.id === form.mecanicoId)
    const vehiculo = vehiculos.find((v) => v.id === form.vehiculoId)
    if (!mecanico || !vehiculo) { setMensaje("Selecciona mecanico y vehiculo."); return }
    setGuardando(true)
    try {
      await addDoc(collection(db, "agenda_mecanicos"), {
        mecanicoId: mecanico.id,
        mecanicoNombre: mecanico.nombre,
        vehiculoId: vehiculo.id,
        matricula: vehiculo.matricula,
        numeroOR: vehiculo.numeroOR,
        cliente: vehiculo.cliente,
        marcaModelo: vehiculo.marcaModelo,
        fechaInicio: form.fechaInicio ? new Date(form.fechaInicio) : new Date(),
        duracionHoras: Number(form.duracionHoras || 0),
        estado: form.estado,
        notas: form.notas.trim(),
        creadoEn: serverTimestamp(),
      })
      setForm((actual) => ({ ...actual, duracionHoras: "1", notas: "" }))
      await cargarDatos()
      setMensaje("Vehiculo asignado correctamente.")
    } catch (error) {
      console.error(error)
      setMensaje("No se ha podido asignar el vehiculo.")
    } finally { setGuardando(false) }
  }

  async function cambiarEstado(id, estado) {
    await updateDoc(doc(db, "agenda_mecanicos", id), { estado, actualizadoEn: serverTimestamp() })
    await cargarDatos()
  }

  async function borrarTrabajo(id) {
    if (!confirm("Quieres eliminar esta asignacion?")) return
    await deleteDoc(doc(db, "agenda_mecanicos", id))
    await cargarDatos()
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agenda Mecanicos</h1>
            <p className="text-gray-600 mt-1">Añade mecanicos y asigna vehiculos a reparar con duracion estimada.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => router.push("/calendario-citas")} className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700">Calendario de Citas</button>
            <button onClick={() => router.push("/calendarios")} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Volver a Calendarios</button>
          </div>
        </header>

        {mensaje && <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">{mensaje}</div>}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form onSubmit={agregarMecanico} className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="text-xl font-bold">Añadir mecanico</h2>
            <input value={nombreMecanico} onChange={(e) => setNombreMecanico(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Nombre del mecanico" />
            <button disabled={guardando} className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60">+ Añadir mecanico</button>
            <div className="pt-2 border-t space-y-2">
              <h3 className="font-semibold">Mecanicos activos</h3>
              {mecanicosActivos.length === 0 ? <p className="text-sm text-gray-500">Todavia no hay mecanicos.</p> : mecanicosActivos.map((m) => (
                <div key={m.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-2">
                  <span className="font-medium">{m.nombre}</span>
                  <button type="button" onClick={() => quitarMecanico(m.id)} className="text-red-600 text-sm font-semibold hover:underline">Quitar</button>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={asignarTrabajo} className="bg-white rounded-xl shadow p-5 space-y-4 lg:col-span-2">
            <h2 className="text-xl font-bold">Asignar vehiculo a mecanico</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select value={form.mecanicoId} onChange={(e) => setForm({ ...form, mecanicoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona mecanico</option>{mecanicosActivos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              <select value={form.vehiculoId} onChange={(e) => setForm({ ...form, vehiculoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona vehiculo</option>{vehiculos.map((v) => <option key={v.id} value={v.id}>{v.matricula || "Sin matricula"} | OR {v.numeroOR || "Sin OR"} {v.cliente ? `| ${v.cliente}` : ""}</option>)}</select>
              <input type="datetime-local" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className="w-full border rounded px-3 py-2" />
              <input type="number" min="0.25" step="0.25" value={form.duracionHoras} onChange={(e) => setForm({ ...form, duracionHoras: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Duracion en horas" />
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full border rounded px-3 py-2"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select>
              <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Notas" />
            </div>
            <button disabled={guardando} className="bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 disabled:opacity-60">Asignar vehiculo</button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow p-5">
          <div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Planificacion</h2><button onClick={cargarDatos} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800">Actualizar</button></div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {mecanicosActivos.map((mecanico) => {
              const lista = trabajos.filter((t) => t.mecanicoId === mecanico.id)
              return <div key={mecanico.id} className="border rounded-xl overflow-hidden">
                <div className="bg-blue-900 text-white px-4 py-3 flex justify-between"><h3 className="font-bold text-lg">{mecanico.nombre}</h3><span>{lista.length} trabajos</span></div>
                {lista.length === 0 ? <p className="p-4 text-gray-500">Sin vehiculos asignados.</p> : lista.map((t) => <article key={t.id} className="p-4 border-t space-y-2">
                  <h4 className="font-bold">{t.matricula || "Sin matricula"} - OR {t.numeroOR || "Sin OR"}</h4>
                  <p className="text-sm text-gray-600">{t.cliente || "Sin cliente"} {t.marcaModelo ? `- ${t.marcaModelo}` : ""}</p>
                  <p className="text-sm">Inicio: {fechaTexto(t.fechaInicio)} - Duracion: {t.duracionHoras || 0} h</p>
                  {t.notas && <p className="text-sm">Notas: {t.notas}</p>}
                  <div className="flex gap-2 flex-wrap">
                    <select value={t.estado || "pendiente"} onChange={(e) => cambiarEstado(t.id, e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select>
                    <button onClick={() => borrarTrabajo(t.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Eliminar</button>
                  </div>
                </article>)}
              </div>
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
