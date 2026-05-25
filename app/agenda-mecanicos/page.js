"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"

const DEFAULT_HORARIO = { horaInicio: "09:00", horaFin: "20:00", pausas: [{ inicio: "14:00", fin: "16:30" }], sabado: false, domingo: false }
const MECANICOS_BASE = ["CHAPA", "David", "Mark", "Moisés", "Rafa", "Titi"]
const pad = (n) => String(n).padStart(2, "0")
const toDate = (v) => v?.toDate?.() ? v.toDate() : v ? new Date(v) : null
const fechaInput = (v = new Date()) => `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}T${pad(v.getHours())}:${pad(v.getMinutes())}`
const fechaDiaInput = (v = new Date()) => `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
const fechaTexto = (v) => { const f = toDate(v); return f && !isNaN(f) ? f.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sin fecha" }
const fechaDiaTexto = (dia) => new Date(`${dia}T12:00:00`).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
const normalizar = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")
const nHora = (h) => { const [a, b] = String(h || "").split(":").map(Number); return Number.isNaN(a) || Number.isNaN(b) ? null : a * 60 + b }
const conHora = (base, min) => { const f = new Date(base); f.setHours(Math.floor(min / 60), min % 60, 0, 0); return f }
const duracionTxt = (h) => { const n = Number(h || 0); if (!n) return "Sin estimar"; const hh = Math.floor(n), mm = Math.round((n - hh) * 60); return hh && mm ? `${hh} h ${mm} min` : hh ? `${hh} h` : `${mm} min` }
const estadoTxt = (e) => e === "terminado" ? "Terminado" : e === "en_proceso" ? "En proceso" : "Pendiente"
const badge = (e) => e === "terminado" ? "bg-green-100 text-green-800 border-green-200" : e === "en_proceso" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"

function horarioOk(h) {
  const base = { ...DEFAULT_HORARIO, ...(h || {}) }
  let pausas = Array.isArray(h?.pausas) ? h.pausas : undefined
  if (!pausas && (h?.pausaInicio || h?.pausaFin)) pausas = [{ inicio: h.pausaInicio || "", fin: h.pausaFin || "" }]
  return { ...base, pausas: (pausas || DEFAULT_HORARIO.pausas).filter((p) => p && (p.inicio || p.fin)) }
}
const horarioTxt = (h) => { const x = horarioOk(h); const p = x.pausas?.length ? ` · Pausas ${x.pausas.map((pa) => `${pa.inicio}-${pa.fin}`).join(", ")}` : " · Sin pausas"; return `${x.horaInicio}-${x.horaFin}${p}${x.sabado ? " · Sab" : ""}${x.domingo ? " · Dom" : ""}` }
const mismoVehiculo = (t, v) => {
  if (t?.vehiculoId && v?.id && String(t.vehiculoId) === String(v.id)) return true
  return normalizar(`${t?.matricula || ""}${t?.numeroOR || ""}`) === normalizar(`${v?.matricula || ""}${v?.numeroOR || ""}`)
}
const mismoMecanico = (t, m) => String(t?.mecanicoId || "") === String(m?.id || "") || normalizar(t?.mecanicoNombre) === normalizar(m?.nombre)

function esLaborable(f, h) {
  const d = f.getDay()
  return (d >= 1 && d <= 5) || (d === 6 && h.sabado) || (d === 0 && h.domingo)
}
function siguienteDia(f, h) {
  const x = new Date(f); x.setDate(x.getDate() + 1); x.setHours(0, 0, 0, 0)
  for (let i = 0; i < 370; i++) { if (esLaborable(x, h)) return conHora(x, nHora(h.horaInicio) ?? 540); x.setDate(x.getDate() + 1) }
  return x
}
function segmentosDia(f, hBase) {
  const h = horarioOk(hBase), ini = nHora(h.horaInicio) ?? 540, fin = nHora(h.horaFin) ?? 1200
  let segmentos = [[ini, fin]]
  const pausas = (h.pausas || []).map((p) => ({ ini: nHora(p.inicio), fin: nHora(p.fin) })).filter((p) => p.ini !== null && p.fin !== null && p.ini > ini && p.fin > p.ini && p.fin < fin).sort((a, b) => a.ini - b.ini)
  for (const pausa of pausas) {
    const nuevos = []
    for (const [a, b] of segmentos) {
      if (pausa.fin <= a || pausa.ini >= b) nuevos.push([a, b])
      else { if (pausa.ini > a) nuevos.push([a, pausa.ini]); if (pausa.fin < b) nuevos.push([pausa.fin, b]) }
    }
    segmentos = nuevos
  }
  return segmentos.map(([a, b]) => [conHora(f, a), conHora(f, b)])
}
function calcularFinLaboral(inicio, horas, base) {
  const h = horarioOk(base); let actual = toDate(inicio) || new Date(); let restante = Math.round(Number(horas || 0) * 60)
  if (!restante) return null
  for (let i = 0; i < 20000; i++) {
    if (!esLaborable(actual, h)) { actual = siguienteDia(actual, h); continue }
    const segmentos = segmentosDia(actual, h), finDia = segmentos[segmentos.length - 1]?.[1]
    if (!finDia || actual >= finDia) { actual = siguienteDia(actual, h); continue }
    let avanzo = false
    for (const [a, b] of segmentos) {
      if (actual < a) actual = new Date(a)
      if (actual >= a && actual < b) {
        const disp = Math.floor((b - actual) / 60000)
        if (restante <= disp) return new Date(actual.getTime() + restante * 60000)
        restante -= disp; actual = new Date(b); avanzo = true
      }
    }
    if (!avanzo || actual >= finDia) actual = siguienteDia(actual, h)
  }
  return null
}
const cambiarDia = (dia, cantidad) => { const f = new Date(`${dia}T12:00:00`); f.setDate(f.getDate() + cantidad); return fechaDiaInput(f) }
const rangoDia = (dia) => ({ inicio: new Date(`${dia}T00:00:00`), fin: new Date(`${dia}T23:59:59.999`) })
function trabajoEnDia(t, mecanico, dia) {
  const ini = toDate(t.fechaInicio); if (!ini) return false
  const fin = calcularFinLaboral(t.fechaInicio, t.duracionHoras, t.horario || mecanico?.horario) || ini
  const r = rangoDia(dia)
  return ini <= r.fin && fin >= r.inicio
}

export default function AgendaMecanicosPage() {
  const router = useRouter()
  const [mecanicos, setMecanicos] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [trabajos, setTrabajos] = useState([])
  const [nombre, setNombre] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [horariosAbiertos, setHorariosAbiertos] = useState({})
  const [diaPlanificacion, setDiaPlanificacion] = useState(fechaDiaInput())
  const [form, setForm] = useState({ mecanicoId: "", vehiculoId: "", tipoVehiculo: "existente", fechaInicio: fechaInput(), duracionHoras: "1", estado: "pendiente", notas: "", manualMatricula: "", manualNumeroOR: "", manualCliente: "", manualMarcaModelo: "" })

  const mecanicosActivos = useMemo(() => mecanicos.filter((m) => m.activo !== false), [mecanicos])
  const vehiculosFiltrados = useMemo(() => {
    const q = normalizar(busqueda)
    const lista = q ? vehiculos.filter((v) => normalizar(`${v.matricula} ${v.numeroOR} ${v.cliente} ${v.marcaModelo}`).includes(q)) : vehiculos
    return lista.slice(0, 100)
  }, [vehiculos, busqueda])
  const trabajosDelDia = useMemo(() => trabajos.filter((t) => trabajoEnDia(t, mecanicosActivos.find((m) => mismoMecanico(t, m)), diaPlanificacion)), [trabajos, mecanicosActivos, diaPlanificacion])
  const resumen = useMemo(() => ({
    total: trabajosDelDia.length,
    pendientes: trabajosDelDia.filter((t) => !t.estado || t.estado === "pendiente").length,
    enProceso: trabajosDelDia.filter((t) => t.estado === "en_proceso").length,
    terminados: trabajosDelDia.filter((t) => t.estado === "terminado").length,
  }), [trabajosDelDia])
  const mostrar = (tipo, titulo, texto) => setAviso({ tipo, titulo, texto })

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    try {
      const [mecSnap, usersSnap, vehSnap, traSnap] = await Promise.all([getDocs(collection(db, "mecanicos")), getDocs(collection(db, "users")), getDocs(collection(db, "cuestionarios_cliente")), getDocs(collection(db, "agenda_mecanicos"))])
      const mapa = new Map(), ocultos = new Set()
      mecSnap.docs.forEach((d) => {
        const x = d.data() || {}, nom = x.nombre || x.displayName || x.email || "Mecanico"
        if (x.activo === false) { ocultos.add(d.id); ocultos.add(x.uid || ""); ocultos.add(normalizar(nom)); return }
        mapa.set(d.id, { id: d.id, nombre: nom, activo: true, uid: x.uid || d.id, horario: horarioOk(x.horario), origen: "manual", ...x })
      })
      usersSnap.docs.forEach((d) => {
        const x = d.data() || {}, rol = String(x.rol || x.role || "").toUpperCase(), nom = x.nombre || x.displayName || x.name || x.email || "Mecanico"
        if (rol.includes("MECANICO") && !ocultos.has(d.id) && !ocultos.has(normalizar(nom)) && !mapa.has(d.id)) mapa.set(d.id, { id: d.id, nombre: nom, activo: x.activo !== false, uid: d.id, horario: horarioOk(x.horario), origen: "usuario" })
      })
      MECANICOS_BASE.forEach((nom) => {
        const id = `base-${normalizar(nom)}`
        if (!ocultos.has(id) && !ocultos.has(normalizar(nom)) && !Array.from(mapa.values()).some((m) => normalizar(m.nombre) === normalizar(nom))) mapa.set(id, { id, nombre: nom, activo: true, horario: DEFAULT_HORARIO, origen: "base" })
      })
      const listaVehiculos = vehSnap.docs.map((d) => {
        const raw = d.data() || {}, x = raw.datos || raw || {}, creado = raw.creadoEn || raw.createdAt || x.creadoEn || x.createdAt || null
        const creadoMs = creado?.toMillis?.() || (creado?.seconds ? creado.seconds * 1000 : 0)
        return { id: d.id, matricula: x.matricula || "", numeroOR: x.numeroOR || "", cliente: x.nombreCliente || x.nombre || "", marcaModelo: x.marcaModelo || x.modelo || "", estadoPresupuesto: raw.estadoPresupuesto || x.estadoPresupuesto || "", creadoMs }
      }).filter((v) => !["FINALIZADO", "DENEGADO"].includes(String(v.estadoPresupuesto || "").toUpperCase())).sort((a, b) => (b.creadoMs || 0) - (a.creadoMs || 0))
      const listaMec = Array.from(mapa.values()).map((m) => ({ ...m, horario: horarioOk(m.horario) })).sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
      const listaTrab = traSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toDate(a.fechaInicio) || new Date(0)) - (toDate(b.fechaInicio) || new Date(0)))
      setMecanicos(listaMec); setVehiculos(listaVehiculos); setTrabajos(listaTrab)
      setForm((f) => ({ ...f, mecanicoId: f.mecanicoId || listaMec[0]?.id || "", vehiculoId: f.vehiculoId || listaVehiculos[0]?.id || "" }))
    } catch (e) { console.error(e); mostrar("error", "Error", "No se ha podido cargar la agenda.") }
  }

  async function agregarMecanico(e) {
    e.preventDefault(); const nom = nombre.trim(); if (!nom) return; setGuardando(true)
    try { await addDoc(collection(db, "mecanicos"), { nombre: nom, activo: true, horario: DEFAULT_HORARIO, creadoEn: serverTimestamp() }); setNombre(""); await cargarDatos(); mostrar("ok", "Mecanico añadido", `${nom} se ha añadido a la agenda.`) }
    catch (e) { console.error(e); mostrar("error", "Error", "No se ha podido añadir el mecanico.") }
    finally { setGuardando(false) }
  }
  function cambiarHorarioLocal(id, campo, valor) { setMecanicos((prev) => prev.map((m) => m.id === id ? { ...m, horario: { ...horarioOk(m.horario), [campo]: valor } } : m)) }
  function agregarPausa(id) { setMecanicos((prev) => prev.map((m) => m.id === id ? { ...m, horario: { ...horarioOk(m.horario), pausas: [...(horarioOk(m.horario).pausas || []), { inicio: "", fin: "" }] } } : m)) }
  function cambiarPausa(id, index, campo, valor) { setMecanicos((prev) => prev.map((m) => { if (m.id !== id) return m; const h = horarioOk(m.horario); const pausas = [...(h.pausas || [])]; pausas[index] = { ...pausas[index], [campo]: valor }; return { ...m, horario: { ...h, pausas } } })) }
  function quitarPausa(id, index) { setMecanicos((prev) => prev.map((m) => { if (m.id !== id) return m; const h = horarioOk(m.horario); return { ...m, horario: { ...h, pausas: (h.pausas || []).filter((_, i) => i !== index) } } })) }
  async function guardarHorario(m) { await setDoc(doc(db, "mecanicos", m.id), { nombre: m.nombre, activo: true, horario: horarioOk(m.horario), actualizadoEn: serverTimestamp() }, { merge: true }); await cargarDatos(); mostrar("ok", "Horario guardado", `Horario actualizado para ${m.nombre}.`) }
  async function quitarMecanico(m) { if (!confirm("Quieres quitar este mecanico de la agenda?")) return; await setDoc(doc(db, "mecanicos", m.id), { nombre: m.nombre, activo: false, uid: m.uid || m.id, actualizadoEn: serverTimestamp() }, { merge: true }); await cargarDatos() }
  async function enviarReporteChat(v, m, inicio, horas, horario) {
    if (v.manual || !v.id) return
    const fin = calcularFinLaboral(inicio, horas, horario)
    const texto = `Agenda mecanicos: se ha asignado el vehiculo ${v.matricula || "Sin matricula"} - OR ${v.numeroOR || "Sin OR"} al mecanico ${m.nombre}. Inicio: ${fechaTexto(inicio)}. Tiempo estimado: ${duracionTxt(horas)}. Horario: ${horarioTxt(horario)}. Finalizacion estimada: ${fechaTexto(fin)}.`
    const user = auth.currentUser
    await addDoc(collection(db, "chats_trabajos", String(v.id), "messages"), { text: texto, createdAt: serverTimestamp(), uid: user?.uid || "agenda-mecanicos", displayName: "Agenda mecanicos" })
    await setDoc(doc(db, "chats_trabajos", String(v.id)), { cuestionarioId: String(v.id), matricula: v.matricula || "", numeroOR: v.numeroOR || "", nombreCliente: v.cliente || "", lastMessage: texto.slice(0, 180), updatedAt: serverTimestamp(), lastSenderUid: user?.uid || "agenda-mecanicos" }, { merge: true })
  }
  async function asignarTrabajo(e) {
    e.preventDefault()
    const mecanico = mecanicosActivos.find((m) => m.id === form.mecanicoId)
    const vehiculo = form.tipoVehiculo === "manual" ? { id: `manual-${Date.now()}`, matricula: form.manualMatricula.trim(), numeroOR: form.manualNumeroOR.trim(), cliente: form.manualCliente.trim(), marcaModelo: form.manualMarcaModelo.trim(), manual: true } : vehiculos.find((v) => v.id === form.vehiculoId)
    if (!mecanico) return mostrar("error", "Falta mecanico", "Selecciona un mecanico.")
    if (!vehiculo || (!vehiculo.matricula && !vehiculo.numeroOR && !vehiculo.cliente)) return mostrar("error", "Falta vehiculo", "Selecciona un vehiculo o escribe uno manualmente.")
    const duplicado = trabajos.find((t) => t.estado !== "terminado" && mismoVehiculo(t, vehiculo))
    if (duplicado) return mostrar("aviso", "Vehiculo ya asignado", `Este vehiculo ya esta asignado a ${duplicado.mecanicoNombre || "un mecanico"}. No se ha duplicado.`)
    setGuardando(true)
    try { const inicio = form.fechaInicio ? new Date(form.fechaInicio) : new Date(); const horas = Number(form.duracionHoras || 0); const horario = horarioOk(mecanico.horario); await addDoc(collection(db, "agenda_mecanicos"), { mecanicoId: mecanico.id, mecanicoNombre: mecanico.nombre, vehiculoId: vehiculo.id, vehiculoManual: !!vehiculo.manual, matricula: vehiculo.matricula, numeroOR: vehiculo.numeroOR, cliente: vehiculo.cliente, marcaModelo: vehiculo.marcaModelo, fechaInicio: inicio, duracionHoras: horas, horario, estado: form.estado, notas: form.notas.trim(), creadoEn: serverTimestamp() }); try { await enviarReporteChat(vehiculo, mecanico, inicio, horas, horario) } catch (err) { console.error(err) }; setForm((f) => ({ ...f, notas: "", manualMatricula: "", manualNumeroOR: "", manualCliente: "", manualMarcaModelo: "" })); await cargarDatos(); setDiaPlanificacion(fechaDiaInput(inicio)); mostrar("ok", "Vehiculo asignado", `Finalizacion segun horario: ${fechaTexto(calcularFinLaboral(inicio, horas, horario))}.`) }
    catch (e) { console.error(e); mostrar("error", "Error", "No se ha podido asignar el vehiculo.") }
    finally { setGuardando(false) }
  }
  async function cambiarEstado(id, estado) { if (estado === "terminado") mostrar("ok", "Trabajo terminado", "Trabajo marcado como terminado."); await updateDoc(doc(db, "agenda_mecanicos", id), { estado, actualizadoEn: serverTimestamp() }); await cargarDatos() }
  async function borrarTrabajo(id) { if (!confirm("Quieres eliminar esta asignacion?")) return; await deleteDoc(doc(db, "agenda_mecanicos", id)); await cargarDatos() }
  const imprimirPlanificacion = () => setTimeout(() => window.print(), 100)
  const estiloAviso = aviso?.tipo === "ok" ? "border-green-300 bg-green-50 text-green-900" : aviso?.tipo === "error" ? "border-red-300 bg-red-50 text-red-900" : "border-amber-300 bg-amber-50 text-amber-900"
  const iconoAviso = aviso?.tipo === "ok" ? "✅" : aviso?.tipo === "error" ? "❌" : "⚠️"

  return <main className="min-h-screen bg-gray-100 p-6">
    <style jsx global>{`@media print{body{background:white!important}.no-print{display:none!important}.print-summary{display:none!important}.print-area{box-shadow:none!important;border:none!important;padding:0!important}.print-grid{display:block!important}.print-card{break-inside:avoid;margin-bottom:16px}}`}</style>
    {aviso && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 no-print"><div className={`w-full max-w-md rounded-2xl border-2 p-6 shadow-2xl ${estiloAviso}`}><div className="flex items-start gap-4"><div className="text-4xl">{iconoAviso}</div><div className="flex-1"><h3 className="text-xl font-bold mb-2">{aviso.titulo}</h3><p className="text-sm leading-relaxed">{aviso.texto}</p></div></div><button onClick={() => setAviso(null)} className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white">Aceptar</button></div></div>}
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between no-print"><div><h1 className="text-3xl font-bold text-gray-900">Agenda Mecanicos</h1><p className="text-gray-600 mt-1">Añade mecanicos, configura su horario y reparte los trabajos por jornada laboral.</p></div><div className="flex gap-3 flex-wrap"><button onClick={() => router.push("/calendario-citas")} className="bg-pink-600 text-white px-4 py-2 rounded">Calendario de Citas</button><button onClick={() => router.push("/calendarios")} className="bg-gray-600 text-white px-4 py-2 rounded">Volver a Calendarios</button></div></header>
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 no-print">
        <form onSubmit={agregarMecanico} className="bg-white rounded-xl shadow p-5 space-y-4"><h2 className="text-xl font-bold">Añadir mecanico</h2><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Nombre del mecanico"/><button disabled={guardando} className="w-full bg-green-600 text-white px-4 py-2 rounded">+ Añadir mecanico</button><div className="pt-2 border-t space-y-3"><h3 className="font-semibold">Mecanicos activos</h3>{mecanicosActivos.length === 0 ? <p className="text-sm text-gray-500">Todavia no hay mecanicos.</p> : mecanicosActivos.map((m) => { const abierto = !!horariosAbiertos[m.id]; const h = horarioOk(m.horario); return <div key={m.id} className="bg-gray-50 rounded px-3 py-3 space-y-2"><div className="flex justify-between items-center gap-2"><b>{m.nombre}</b><div className="flex gap-2"><button type="button" onClick={() => setHorariosAbiertos((p) => ({ ...p, [m.id]: !p[m.id] }))} className="bg-purple-600 text-white text-xs px-3 py-1 rounded">Horario</button><button type="button" onClick={() => quitarMecanico(m)} className="text-red-600 text-sm">Quitar</button></div></div>{abierto && <div className="space-y-3 rounded border bg-white p-3"><div className="grid grid-cols-2 gap-2 text-xs"><label>Entrada<input type="time" value={h.horaInicio} onChange={(e) => cambiarHorarioLocal(m.id, "horaInicio", e.target.value)} className="w-full border rounded px-2 py-1"/></label><label>Salida<input type="time" value={h.horaFin} onChange={(e) => cambiarHorarioLocal(m.id, "horaFin", e.target.value)} className="w-full border rounded px-2 py-1"/></label></div><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-xs font-semibold">Pausas</span><button type="button" onClick={() => agregarPausa(m.id)} className="bg-green-600 text-white text-xs px-2 py-1 rounded">+ Añadir pausa</button></div>{h.pausas.length === 0 ? <p className="text-xs text-gray-500">Sin pausas. Ideal si trabaja seguido, por ejemplo 07:00 a 15:00.</p> : h.pausas.map((p, i) => <div key={i} className="grid grid-cols-5 gap-2 items-end text-xs"><label className="col-span-2">Inicio pausa<input type="time" value={p.inicio || ""} onChange={(e) => cambiarPausa(m.id, i, "inicio", e.target.value)} className="w-full border rounded px-2 py-1"/></label><label className="col-span-2">Fin pausa<input type="time" value={p.fin || ""} onChange={(e) => cambiarPausa(m.id, i, "fin", e.target.value)} className="w-full border rounded px-2 py-1"/></label><button type="button" onClick={() => quitarPausa(m.id, i)} className="text-red-600 text-xs pb-1">Quitar</button></div>)}</div><div className="flex gap-3 text-xs"><label><input type="checkbox" checked={!!h.sabado} onChange={(e) => cambiarHorarioLocal(m.id, "sabado", e.target.checked)}/> Sabado</label><label><input type="checkbox" checked={!!h.domingo} onChange={(e) => cambiarHorarioLocal(m.id, "domingo", e.target.checked)}/> Domingo</label></div><button type="button" onClick={() => guardarHorario(m)} className="w-full bg-blue-700 text-white rounded px-3 py-1 text-sm">Guardar horario</button></div>}<p className="text-xs text-gray-500">{horarioTxt(m.horario)}</p></div>})}</div></form>
        <form onSubmit={asignarTrabajo} className="bg-white rounded-xl shadow p-5 space-y-4 lg:col-span-2"><h2 className="text-xl font-bold">Asignar vehiculo a mecanico</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label className="space-y-1"><span className="text-sm font-semibold">Mecanico</span><select value={form.mecanicoId} onChange={(e) => setForm({ ...form, mecanicoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona mecanico</option>{mecanicosActivos.map((m) => <option key={m.id} value={m.id}>{m.nombre} · {horarioTxt(m.horario)}</option>)}</select></label><label className="space-y-1"><span className="text-sm font-semibold">Tipo de vehiculo</span><select value={form.tipoVehiculo} onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value })} className="w-full border rounded px-3 py-2"><option value="existente">Buscar vehiculo de la aplicacion</option><option value="manual">Agregar vehiculo manual</option></select></label></div>
          {form.tipoVehiculo === "existente" ? <div className="space-y-3 rounded-lg border bg-gray-50 p-4"><input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="Busca por matricula, OR, cliente o modelo"/><select value={form.vehiculoId} onChange={(e) => setForm({ ...form, vehiculoId: e.target.value })} className="w-full border rounded px-3 py-2"><option value="">Selecciona vehiculo</option>{vehiculosFiltrados.map((v) => <option key={v.id} value={v.id}>{v.matricula || "Sin matricula"} | OR {v.numeroOR || "Sin OR"} {v.cliente ? `| ${v.cliente}` : ""} {v.marcaModelo ? `| ${v.marcaModelo}` : ""}</option>)}</select><p className="text-xs text-gray-500">Los vehiculos aparecen de mas recientes a mas antiguos.</p></div> : <div className="rounded-lg border bg-gray-50 p-4 grid grid-cols-1 md:grid-cols-2 gap-4"><input value={form.manualMatricula} onChange={(e) => setForm({ ...form, manualMatricula: e.target.value.toUpperCase() })} className="border rounded px-3 py-2" placeholder="Matricula"/><input value={form.manualNumeroOR} onChange={(e) => setForm({ ...form, manualNumeroOR: e.target.value })} className="border rounded px-3 py-2" placeholder="Nº OR / referencia"/><input value={form.manualCliente} onChange={(e) => setForm({ ...form, manualCliente: e.target.value })} className="border rounded px-3 py-2" placeholder="Cliente"/><input value={form.manualMarcaModelo} onChange={(e) => setForm({ ...form, manualMarcaModelo: e.target.value })} className="border rounded px-3 py-2" placeholder="Marca / modelo"/></div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><label>Fecha y hora de inicio<input type="datetime-local" value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} className="w-full border rounded px-3 py-2"/></label><label>Tiempo estimado de reparacion<div className="flex"><input type="number" min="0.25" step="0.25" value={form.duracionHoras} onChange={(e) => setForm({ ...form, duracionHoras: e.target.value })} className="w-full border rounded-l px-3 py-2"/><span className="border border-l-0 rounded-r px-3 py-2 bg-gray-100">horas</span></div><p className="text-xs text-gray-500">El horario por defecto es 09:00-14:00 y 16:30-20:00.</p></label><label>Estado<select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="w-full border rounded px-3 py-2"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select></label><label>Notas<input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} className="w-full border rounded px-3 py-2" placeholder="Notas"/></label></div><button disabled={guardando} className="bg-blue-700 text-white px-5 py-2 rounded">Asignar vehiculo</button></form>
      </section>
      <section className="bg-white rounded-xl shadow p-5 print-area"><div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-4"><div><h2 className="text-xl font-bold">Planificacion</h2><p className="text-sm text-gray-600 capitalize">{fechaDiaTexto(diaPlanificacion)}</p><p className="text-sm text-gray-500 print:block hidden">Impreso el {new Date().toLocaleString("es-ES")}</p></div><div className="flex flex-wrap gap-2 no-print"><button type="button" onClick={() => setDiaPlanificacion(cambiarDia(diaPlanificacion, -1))} className="bg-gray-600 text-white px-3 py-2 rounded">← Día anterior</button><input type="date" value={diaPlanificacion} onChange={(e) => setDiaPlanificacion(e.target.value)} className="border rounded px-3 py-2"/><button type="button" onClick={() => setDiaPlanificacion(fechaDiaInput())} className="bg-blue-700 text-white px-3 py-2 rounded">Hoy</button><button type="button" onClick={() => setDiaPlanificacion(cambiarDia(diaPlanificacion, 1))} className="bg-gray-600 text-white px-3 py-2 rounded">Día siguiente →</button><button onClick={imprimirPlanificacion} className="bg-green-600 text-white px-4 py-2 rounded">Imprimir planificación</button><button onClick={cargarDatos} className="bg-gray-700 text-white px-4 py-2 rounded">Actualizar</button></div></div><div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Recordatorio:</strong> cuando se finalice un trabajo, avisar al asesor por chat o presencialmente.</div><div className="print-summary grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"><div className="bg-gray-50 border rounded p-3"><p className="text-xs text-gray-500">Trabajos del día</p><b>{resumen.total}</b></div><div className="bg-yellow-50 border rounded p-3"><p className="text-xs text-gray-500">Pendientes</p><b>{resumen.pendientes}</b></div><div className="bg-blue-50 border rounded p-3"><p className="text-xs text-gray-500">En proceso</p><b>{resumen.enProceso}</b></div><div className="bg-green-50 border rounded p-3"><p className="text-xs text-gray-500">Terminados</p><b>{resumen.terminados}</b></div></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-5 print-grid">{mecanicosActivos.map((m) => { const lista = trabajosDelDia.filter((t) => mismoMecanico(t, m)); const horas = lista.reduce((a, t) => a + Number(t.duracionHoras || 0), 0); return <div key={m.id} className="border rounded-xl overflow-hidden print-card"><div className="bg-blue-900 text-white px-4 py-3 flex justify-between"><h3 className="font-bold text-lg">{m.nombre}</h3><span>{lista.length} trabajos · {duracionTxt(horas)}</span></div><p className="text-xs text-gray-500 px-4 pt-3">Horario: {horarioTxt(m.horario)}</p>{lista.length === 0 ? <p className="p-4 text-gray-500">Sin vehículos asignados este día.</p> : lista.map((t) => { const fin = calcularFinLaboral(t.fechaInicio, t.duracionHoras, t.horario || m.horario); return <article key={t.id} className="p-4 border-t space-y-2"><div className="flex justify-between gap-3"><h4 className="font-bold">{t.matricula || "Sin matrícula"} - OR {t.numeroOR || "Sin OR"}</h4><span className={`text-xs border px-2 py-1 rounded-full font-bold ${badge(t.estado)}`}>{estadoTxt(t.estado)}</span></div><p className="text-sm text-gray-600">{t.cliente || "Sin cliente"} {t.marcaModelo ? `- ${t.marcaModelo}` : ""}</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm"><p>Inicio: <strong>{fechaTexto(t.fechaInicio)}</strong></p><p>Finalización estimada: <strong>{fechaTexto(fin)}</strong></p><p>Tiempo total estimado: <strong>{duracionTxt(t.duracionHoras)}</strong></p></div><p className="text-sm rounded bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900"><strong>Al finalizar:</strong> avisar al asesor por chat o presencialmente.</p>{t.notas && <p className="text-sm">Notas: {t.notas}</p>}<div className="flex gap-2 no-print"><select value={t.estado || "pendiente"} onChange={(e) => cambiarEstado(t.id, e.target.value)} className="border rounded px-2 py-1 text-sm"><option value="pendiente">Pendiente</option><option value="en_proceso">En proceso</option><option value="terminado">Terminado</option></select><button onClick={() => borrarTrabajo(t.id)} className="bg-red-500 text-white px-3 py-1 rounded text-sm">Eliminar</button></div></article>})}</div>})}</div></section>
    </div>
  </main>
}
