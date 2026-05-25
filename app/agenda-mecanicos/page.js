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

function getFecha(valor) {
  if (!valor) return null
  const fecha = valor?.toDate?.() ? valor.toDate() : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

function fechaTexto(valor) {
  const fecha = getFecha(valor)
  if (!fecha) return "Sin fecha"
  return fecha.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fechaFin(valor, horas) {
  const inicio = getFecha(valor)
  const duracion = Number(horas || 0)
  if (!inicio || !duracion) return null
  return new Date(inicio.getTime() + duracion * 60 * 60 * 1000)
}

function fechaFinTexto(valor, horas) {
  const fin = fechaFin(valor, horas)
  if (!fin) return "Sin estimar"
  return fin.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function duracionTexto(horas) {
  const h = Number(horas || 0)
  if (!h) return "Sin estimar"
  const horasEnteras = Math.floor(h)
  const minutos = Math.round((h - horasEnteras) * 60)
  if (horasEnteras > 0 && minutos > 0) return `${horasEnteras} h ${minutos} min`
  if (horasEnteras > 0) return `${horasEnteras} h`
  return `${minutos} min`
}

function estaRetrasado(trabajo) {
  if (trabajo.estado === "terminado") return false
  const fin = fechaFin(trabajo.fechaInicio, trabajo.duracionHoras)
  return !!fin && fin < new Date()
}

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
}

function nombreEstado(estado) {
  if (estado === "en_proceso") return "En proceso"
  if (estado === "terminado") return "Terminado"
  return "Pendiente"
}

function badgeEstado(estado) {
  if (estado === "terminado") return "bg-green-100 text-green-800 border-green-200"
  if (estado === "en_proceso") return "bg-blue-100 text-blue-800 border-blue-200"
  return "bg-yellow-100 text-yellow-800 border-yellow-200"
}

export default function AgendaMecanicosPage() {
  const router = useRouter()
  const [mecanicos, setMecanicos] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [nombreMecanico, setNombreMecanico] = useState("")
  const [busquedaVehiculo, setBusquedaVehiculo] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    mecanicoId: "",
    vehiculoId: "",
    tipoVehiculo: "existente",
    fechaInicio: fechaInput(new Date()),
    duracionHoras: "1",
    estado: "pendiente",
    notas: "",
    manualMatricula: "",
    manualNumeroOR: "",
    manualCliente: "",
    manualMarcaModelo: "",
  })

  const mecanicosActivos = useMemo(() => mecanicos.filter((m) => m.activo !== false), [mecanicos])
  const vehiculosFiltrados = useMemo(() => {
    const q = normalizar(busquedaVehiculo)
    if (!q) return vehiculos.slice(0, 80)
    return vehiculos.filter((v) => normalizar(`${v.matricula} ${v.numeroOR} ${v.cliente} ${v.marcaModelo}`).includes(q)).slice(0, 80)
  }, [vehiculos, busquedaVehiculo])

  const resumen = useMemo(() => {
    const totalHoras = trabajos.reduce((acc, t) => acc + Number(t.duracionHoras || 0), 0)
    return {
      total: trabajos.length,
      pendientes: trabajos.filter((t) => !t.estado || t.estado === "pendiente").length,
      enProceso: trabajos.filter((t) => t.estado === "en_proceso").length,
      terminados: trabajos.filter((t) => t.estado === "terminado").length,
      retrasados: trabajos.filter((t) => estaRetrasado(t)).length,
      totalHoras,
    }
  }, [trabajos])

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setMensaje("")
    try {
      const [mecSnap, usersSnap, vehSnap, traSnap] = await Promise.all([
        getDocs(collection(db, "mecanicos")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "cuestionarios_cliente")),
        getDocs(collection(db, "agenda_mecanicos")),
      ])

      const ocultos = new Set()
      mecSnap.docs.forEach((d) => {
        const data = d.data() || {}
        if (data.activo === false) {
          ocultos.add(data.uid || d.id)
          ocultos.add(normalizar(data.nombre))
        }
      })

      const mapaMecanicos = new Map()

      mecSnap.docs.forEach((d) => {
        const data = d.data() || {}
        if (data.activo === false) return
        const nombre = data.nombre || data.displayName || data.email || "Mecanico"
        mapaMecanicos.set(d.id, { id: d.id, nombre, activo: true, origen: "manual", ...data })
      })

      usersSnap.docs.forEach((d) => {
        const data = d.data() || {}
        const rol = String(data.rol || data.role || "").toUpperCase()
        if (rol.includes("MECANICO") && !ocultos.has(d.id)) {
          const nombre = data.nombre || data.displayName || data.name || data.email || "Mecanico"
          if (!ocultos.has(normalizar(nombre)) && !mapaMecanicos.has(d.id)) {
            mapaMecanicos.set(d.id, { id: d.id, nombre, activo: data.activo !== false, origen: "usuario", uid: d.id })
          }
        }
      })

      const listaVehiculos = vehSnap.docs.map((d) => {
        const docData = d.data() || {}
        const datos = docData.datos || docData || {}

        if (docData.asignadoMecanicoUid || docData.asignadoMecanicoNombre) {
          const mecId = docData.asignadoMecanicoUid || `asignado-${normalizar(docData.asignadoMecanicoNombre)}`
          const nombre = docData.asignadoMecanicoNombre || "Mecanico asignado"
          if (!ocultos.has(mecId) && !ocultos.has(normalizar(nombre)) && !mapaMecanicos.has(mecId)) {
            mapaMecanicos.set(mecId, { id: mecId, nombre, activo: true, origen: "asignado", uid: docData.asignadoMecanicoUid || null })
          }
        }

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

      const listaMecanicos = Array.from(mapaMecanicos.values()).sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || "")))

      const listaTrabajos = traSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const fa = getFecha(a.fechaInicio) || new Date(0)
        const fb = getFecha(b.fechaInicio) || new Date(0)
        return fa - fb
      })

      setMecanicos(listaMecanicos)
      setVehiculos(listaVehiculos)
      setTrabajos(listaTrabajos)
      setForm((actual) => ({
        ...actual,
        mecanicoId: actual.mecanicoId || listaMecanicos.find((m) => m.activo !== false)?.id || "",
        vehiculoId: actual.vehiculoId || listaVehiculos[0]?.id || "",
      }))
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

  async function quitarMecanico(mecanico) {
    if (!confirm("Quieres quitar este mecanico de la agenda?")) return
    try {
      if (mecanico.origen === "manual") {
        await updateDoc(doc(db, "mecanicos", mecanico.id), { activo: false, actualizadoEn: serverTimestamp() })
      } else {
        await addDoc(collection(db, "mecanicos"), { nombre: mecanico.nombre, activo: false, origenOculto: mecanico.origen || "usuario", uid: mecanico.uid || mecanico.id, creadoEn: serverTimestamp() })
      }
      await cargarDatos()
    } catch (error) {
      console.error(error)
      setMensaje("No se ha podido quitar el mecanico.")
    }
  }

  async function asignarTrabajo(e) {
    e.preventDefault()
    const mecanico = mecanicosActivos.find((m) => m.id === form.mecanicoId)
    const vehiculo = form.tipoVehiculo === "manual"
      ? { id: `manual-${Date.now()}`, matricula: form.manualMatricula.trim(), numeroOR: form.manualNumeroOR.trim(), cliente: form.manualCliente.trim(), marcaModelo: form.manualMarcaModelo.trim(), manual: true }
      : vehiculos.find((v) => v.id === form.vehiculoId)

    if (!mecanico) { setMensaje("Selecciona mecanico."); return }
    if (!vehiculo || (!vehiculo.matricula && !vehiculo.numeroOR && !vehiculo.cliente)) { setMensaje("Selecciona un vehiculo o escribe uno manualmente."); return }

    setGuardando(true)
    try {
      await addDoc(collection(db, "agenda_mecanicos"), {
        mecanicoId: mecanico.id,
        mecanicoNombre: mecanico.nombre,
        vehiculoId: vehiculo.id,
        vehiculoManual: !!vehiculo.manual,
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
      setForm((actual) => ({ ...actual, duracionHoras: "1", notas: "", manualMatricula: "", manualNumeroOR: "", manualCliente: "", manualMarcaModelo: "" }))
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

  function imprimirPlanificacion() {
    setTimeout(() => window.print(), 100)
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .print-grid { display: block !important; }
          .print-card { break-inside: avoid; margin-bottom: 16px; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Agenda Mecanicos</h1>
            <p className="text-gray-600 mt-1">Añade mecanicos y asigna vehiculos a reparar con duracion estimada.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => router.push("/calendario-citas")} className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700">Calendario de Citas</button>
            <button onClick={() => router.push("/calendarios")} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Volver a Calendarios</button>
          </div>
        </header>

        {mensaje && <div className="no-print bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded">{mensaje}</div>}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 no-print">
          <form onSubmit={agregarMecanico} className="bg-white rounded-xl shadow p-5 space-y-4">
            <h2 className="text-xl font-bold">Añadir mecanico</h2>
            <p className="text-sm text-gray-500">Tambien se cargan automaticamente los usuarios mecanicos y los mecanicos ya asignados en trabajos.</p>
            <input value={nombreMecanico} onChange={(e) => setNombreMecanico(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Nombre del mecanico" />
            <button disabled={guardando} className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60">+ Añadir mecanico</button>
            <div className="pt-2 border-t space-y-2">
              <h3 className="font-semibold">Mecanicos activos</h3>
              {mecanicosActivos.length === 0 ? <p className="text-sm text-gray-500">Todavia no hay mecanicos.</p> : mecanicosActivos.map((m) => (
                <div key={m.id} className="flex justify-between items-center bg-gray-50 rounded px-3 py-2">
                  <span className="font-medium">{m.nombre}</span>
                  <button type="button" onClick={() => quitarMecanico(m)} className="text-red-600 text-sm font-semibold hover:underline">Quitar</button>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={asignarTrabajo} className="bg-white rounded-xl shadow p-5 space-y-4 lg:col-span-2">
            <h2 className="text-xl font-bold">Asignar vehiculo a mecanico</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1"><span className="text-sm font-semibold">Mecanico</span><select value={form.mecanicoId} onChange={(e) => setForm({ ...form, mecanicoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona mecanico</option>{mecanicosActivos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></label>
              <label className="space-y-1"><span className="text-sm font-semibold">Tipo de vehiculo</span><select value={form.tipoVehiculo} onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value })} className="w-full border rounded px-3 py-2"><option value="existente">Buscar vehiculo de la aplicacion</option><option value="manual">Agregar vehiculo manual</option></select></label>
            </div>

            {form.tipoVehiculo === "existente" ? (
              <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
                <label className="space-y-1 block"><span className="text-sm font-semibold">Buscar entre vehiculos de la aplicacion</span><input value={busquedaVehiculo} onChange={(e) => setBusquedaVehiculo(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Busca por matricula, OR, cliente o modelo" /></label>
                <select value={form.vehiculoId} onChange={(e) => setForm({ ...form, vehiculoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona vehiculo</option>{vehiculosFiltrados.map((v) => <option key={v.id} value={v.id}>{v.matricula || "Sin matricula"} | OR {v.numeroOR || "Sin OR"} {v.cliente ? `| ${v.cliente}` : ""} {v.marcaModelo ? `| ${v.marcaModelo}` : ""}</option>)}</select>
              </div>
            ) : (
              <div className="rounded-lg border bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4"><input value={form.manualMatricula} onChange={(e) => setForm({ ...form, manualMatricula: e.target.value.toUpperCase() })} className="w-full border rounded px-3 py-2" placeholder="Matricula" /><input value={form.manualNumeroOR} onChange={(e) => setForm({ ...form, manualNumeroOR: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Nº OR / referencia" /><input value={form.manualCliente} onChange={(e) => setForm({ ...form, manualCliente: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Cliente" /><input value={form.manualMarcaModelo} onChange={(e) => setForm({ ...form, manualMarcaModelo: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Marca / modelo" /></div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="space-y-1"><span className="text-sm font-semibold">Fecha y hora de inicio</span><input type="datetime-local" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className="w-full border rounded px-3 py-2" /></label>
              <label className="space-y-1"><span className="text-sm font-semibold">Tiempo estimado de reparacion</span><div className="flex"><input type="number" min="0.25" step="0.25" value={form.duracionHoras} onChange={(e) => setForm({ ...form, duracionHoras: e.target.value })} className="w-full border rounded-l px-3 py-2" placeholder="Ej: 2" /><span className="border border-l-0 rounded-r px-3 py-2 bg-gray-100 text-gray-700">horas</span></div><p className="text-xs text-gray-500">Ejemplos: 0.5 = media hora, 1 = una hora, 2 = dos horas.</p></label>
              <label className="space-y-1"><span className="text-sm font-semibold">Estado</span><select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full border rounded px-3 py-2"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select></label>
              <label className="space-y-1"><span className="text-sm font-semibold">Notas</span><input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Notas" /></label>
            </div>
            <button disabled={guardando} className="bg-blue-700 text-white px-5 py-2 rounded hover:bg-blue-800 disabled:opacity-60">Asignar vehiculo</button>
          </form>
        </section>

        <section className="bg-white rounded-xl shadow p-5 print-area">
          <div className="flex justify-between items-center mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold">Planificacion</h2>
              <p className="text-sm text-gray-500 print:block hidden">Impreso el {new Date().toLocaleString("es-ES")}</p>
            </div>
            <div className="flex gap-2 no-print"><button onClick={imprimirPlanificacion} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Imprimir planificacion</button><button onClick={cargarDatos} className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800">Actualizar</button></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <div className="bg-gray-50 border rounded p-3"><p className="text-xs text-gray-500">Trabajos</p><p className="text-xl font-bold">{resumen.total}</p></div>
            <div className="bg-yellow-50 border rounded p-3"><p className="text-xs text-gray-500">Pendientes</p><p className="text-xl font-bold">{resumen.pendientes}</p></div>
            <div className="bg-blue-50 border rounded p-3"><p className="text-xs text-gray-500">En proceso</p><p className="text-xl font-bold">{resumen.enProceso}</p></div>
            <div className="bg-green-50 border rounded p-3"><p className="text-xs text-gray-500">Terminados</p><p className="text-xl font-bold">{resumen.terminados}</p></div>
            <div className="bg-red-50 border rounded p-3"><p className="text-xs text-gray-500">Retrasados</p><p className="text-xl font-bold">{resumen.retrasados}</p></div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 print-grid">
            {mecanicosActivos.map((mecanico) => {
              const lista = trabajos.filter((t) => t.mecanicoId === mecanico.id)
              const horasMecanico = lista.reduce((acc, t) => acc + Number(t.duracionHoras || 0), 0)
              return <div key={mecanico.id} className="border rounded-xl overflow-hidden print-card">
                <div className="bg-blue-900 text-white px-4 py-3 flex justify-between"><h3 className="font-bold text-lg">{mecanico.nombre}</h3><span>{lista.length} trabajos · {duracionTexto(horasMecanico)}</span></div>
                {lista.length === 0 ? <p className="p-4 text-gray-500">Sin vehiculos asignados.</p> : lista.map((t) => {
                  const retrasado = estaRetrasado(t)
                  return <article key={t.id} className={`p-4 border-t space-y-2 ${retrasado ? "bg-red-50" : ""}`}>
                    <div className="flex justify-between gap-3 flex-wrap"><h4 className="font-bold">{t.matricula || "Sin matricula"} - OR {t.numeroOR || "Sin OR"} {t.vehiculoManual ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">Manual</span> : null}</h4><span className={`text-xs border px-2 py-1 rounded-full font-bold ${badgeEstado(t.estado)}`}>{nombreEstado(t.estado)}</span></div>
                    <p className="text-sm text-gray-600">{t.cliente || "Sin cliente"} {t.marcaModelo ? `- ${t.marcaModelo}` : ""}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm"><p>Inicio: <strong>{fechaTexto(t.fechaInicio)}</strong></p><p>Finalizacion estimada: <strong>{fechaFinTexto(t.fechaInicio, t.duracionHoras)}</strong></p><p>Tiempo estimado: <strong>{duracionTexto(t.duracionHoras)}</strong></p>{retrasado && <p className="text-red-700 font-bold">⚠ Trabajo fuera de hora estimada</p>}</div>
                    {t.notas && <p className="text-sm">Notas: {t.notas}</p>}
                    <div className="flex gap-2 flex-wrap no-print"><select value={t.estado || "pendiente"} onChange={(e) => cambiarEstado(t.id, e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select><button onClick={() => borrarTrabajo(t.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">Eliminar</button></div>
                  </article>
                })}
              </div>
            })}
          </div>
        </section>
      </div>
    </main>
  )
}
