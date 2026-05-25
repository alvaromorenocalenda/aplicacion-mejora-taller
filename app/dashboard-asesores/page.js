"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { subscribeUserProfile } from "@/lib/userProfile";

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const toDate = (v) => v?.toDate?.() ? v.toDate() : v ? new Date(v) : null;
const fechaTexto = (v) => {
  const d = toDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";
};
const estadoTxt = (e) => e === "terminado" ? "Terminado" : e === "en_proceso" ? "En proceso" : "Pendiente";

export default function DashboardAsesoresPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rol, setRol] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trabajos, setTrabajos] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const hoy = useMemo(() => hoyISO(), []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); if (!u) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => setRol((p?.rol || "ADMIN").toUpperCase()));
  }, [user]);

  const permitido = rol && rol !== "MECANICO";

  async function cargar() {
    if (!permitido) return;
    setLoading(true);
    try {
      const [trabSnap, agendaSnap, notifSnap] = await Promise.all([
        getDocs(query(collection(db, "cuestionarios_cliente"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "agenda_mecanicos"), orderBy("fechaInicio", "asc"))),
        getDocs(query(collection(db, "notificaciones"), orderBy("creadoEn", "desc"))),
      ]);
      setTrabajos(trabSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAgenda(agendaSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setNotificaciones(notifSnap.docs.map((d) => ({ id: d.id, ...d.data() })).slice(0, 30));
    } catch (e) {
      console.error(e);
      alert("No se ha podido cargar el dashboard de asesores.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (permitido) cargar(); }, [permitido]);

  const agendaHoy = agenda.filter((t) => {
    const d = toDate(t.fechaInicio);
    if (!d) return false;
    const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return dia === hoy;
  });
  const pendientesPresupuesto = trabajos.filter((t) => String(t.estadoPresupuesto || "").toUpperCase() === "PENDIENTE_PRESUPUESTO");
  const finalizados = trabajos.filter((t) => String(t.estadoPresupuesto || "").toUpperCase() === "FINALIZADO");
  const denegados = trabajos.filter((t) => String(t.estadoPresupuesto || "").toUpperCase() === "DENEGADO");
  const avisosSinLeer = notificaciones.filter((n) => !n.leida);
  const agendaEnProceso = agendaHoy.filter((t) => t.estado === "en_proceso");
  const agendaPendiente = agendaHoy.filter((t) => !t.estado || t.estado === "pendiente");

  if (!rol) return <main className="p-6 max-w-6xl mx-auto"><p>Cargando permisos...</p></main>;
  if (!permitido) return <main className="p-6 max-w-4xl mx-auto"><h1 className="text-3xl font-bold mb-4">Dashboard Asesores</h1><div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">Esta pantalla es solo para asesores y administradores.</div></main>;

  return <main className="min-h-screen bg-gray-100 p-6">
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Control</h1>
          <p className="text-gray-600">Panel rápido para asesores: agenda, trabajos, chats y avisos internos.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={cargar} className="bg-blue-700 text-white px-4 py-2 rounded">Actualizar</button>
          <button onClick={() => router.push("/notificaciones")} className="bg-amber-600 text-white px-4 py-2 rounded">Notificaciones</button>
          <button onClick={() => router.push("/dashboard")} className="bg-gray-700 text-white px-4 py-2 rounded">Dashboard</button>
        </div>
      </header>

      {loading ? <div className="bg-white rounded-xl shadow p-5">Cargando datos...</div> : <>
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-600"><p className="text-sm text-gray-500">Trabajos pendientes</p><p className="text-3xl font-bold">{pendientesPresupuesto.length}</p></div>
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-purple-600"><p className="text-sm text-gray-500">Agenda hoy</p><p className="text-3xl font-bold">{agendaHoy.length}</p></div>
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-amber-500"><p className="text-sm text-gray-500">Avisos sin leer</p><p className="text-3xl font-bold">{avisosSinLeer.length}</p></div>
          <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-600"><p className="text-sm text-gray-500">Finalizados</p><p className="text-3xl font-bold">{finalizados.length}</p></div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-3"><h2 className="text-xl font-bold">Carga de trabajo de hoy</h2><button onClick={() => router.push("/agenda-mecanicos")} className="text-blue-700 font-semibold text-sm">Ver agenda</button></div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-yellow-50 border rounded p-3"><p className="text-xs text-gray-500">Pendientes</p><b>{agendaPendiente.length}</b></div>
              <div className="bg-blue-50 border rounded p-3"><p className="text-xs text-gray-500">En proceso</p><b>{agendaEnProceso.length}</b></div>
              <div className="bg-green-50 border rounded p-3"><p className="text-xs text-gray-500">Terminados</p><b>{agendaHoy.filter((t) => t.estado === "terminado").length}</b></div>
            </div>
            <div className="space-y-2 max-h-80 overflow-auto">
              {agendaHoy.length === 0 ? <p className="text-gray-500">No hay trabajos en agenda hoy.</p> : agendaHoy.map((t) => <div key={t.id} className="border rounded p-3 flex justify-between gap-3">
                <div><b>{t.matricula || "Sin matrícula"} - OR {t.numeroOR || "Sin OR"}</b><p className="text-sm text-gray-600">{t.mecanicoNombre || "Sin mecánico"} · {t.cliente || "Sin cliente"}</p><p className="text-xs text-gray-500">Inicio: {fechaTexto(t.fechaInicio)}</p></div>
                <span className="text-xs rounded-full bg-gray-100 px-2 py-1 h-fit">{estadoTxt(t.estado)}</span>
              </div>)}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-5">
            <div className="flex justify-between items-center mb-3"><h2 className="text-xl font-bold">Notificaciones internas</h2><button onClick={() => router.push("/notificaciones")} className="text-blue-700 font-semibold text-sm">Ver todas</button></div>
            <div className="space-y-2 max-h-96 overflow-auto">
              {notificaciones.length === 0 ? <p className="text-gray-500">No hay notificaciones.</p> : notificaciones.slice(0, 12).map((n) => <button key={n.id} onClick={() => n.url ? router.push(n.url) : null} className={`block w-full text-left border rounded p-3 ${n.leida ? "bg-white" : "bg-amber-50 border-amber-200"}`}>
                <b>{n.titulo || "Aviso"}</b><p className="text-sm text-gray-700">{n.mensaje || ""}</p><p className="text-xs text-gray-500">{fechaTexto(n.creadoEn)}</p>
              </button>)}
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl shadow p-5">
          <h2 className="text-xl font-bold mb-3">Resumen general de trabajos</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-50 border rounded p-3"><p className="text-xs text-gray-500">Total trabajos</p><b>{trabajos.length}</b></div>
            <div className="bg-yellow-50 border rounded p-3"><p className="text-xs text-gray-500">Pendientes presupuesto</p><b>{pendientesPresupuesto.length}</b></div>
            <div className="bg-green-50 border rounded p-3"><p className="text-xs text-gray-500">Finalizados</p><b>{finalizados.length}</b></div>
            <div className="bg-red-50 border rounded p-3"><p className="text-xs text-gray-500">Denegados</p><b>{denegados.length}</b></div>
          </div>
        </section>
      </>}
    </div>
  </main>;
}
