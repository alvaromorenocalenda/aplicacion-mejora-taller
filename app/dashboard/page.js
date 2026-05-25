// app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, getDoc, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { registerPushForUser } from "../../lib/pushNotifications";
import { deleteChatTrabajo } from "../../lib/chatCleanup";
import { subscribeUserProfile } from "../../lib/userProfile";

const CONFIRM_KEY = "CALENDABORRAR";
const CONFIRM_DENY_KEY = "CALENDADENEGAR";
const CONFIRM_FINISH_KEY = "CALENDAFINALIZAR";

const toDate = (v) => v?.toDate?.() ? v.toDate() : v ? new Date(v) : null;
const fechaTexto = (v) => {
  const d = toDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadMap, setUnreadMap] = useState({});
  const [userRol, setUserRol] = useState("ADMIN");
  const [onlyMine, setOnlyMine] = useState(true);
  const [pushStatus, setPushStatus] = useState("idle");
  const [stats, setStats] = useState({ pendientes: 0, finalizados: 0, denegados: 0, agendaHoy: 0, avisos: 0, chatsNuevos: 0, agendaPendiente: 0, agendaProceso: 0 });
  const esAsesor = userRol !== "MECANICO";

  const menuPrincipal = [
    { label: "Calendarios", color: "bg-pink-500 hover:bg-pink-600", url: "/calendarios" },
    { label: "Nuevo cuestionario", color: "bg-blue-600 hover:bg-blue-700", url: "/cliente-form" },
    { label: "Diagnósticos", color: "bg-yellow-500 hover:bg-yellow-600", url: "/diagnostico-form" },
    { label: "Recambios", color: "bg-blue-800 hover:bg-blue-900", url: "/recambios-form" },
    { label: "Chats", color: "bg-fuchsia-600 hover:bg-fuchsia-700", url: "/chats" },
    { label: "Imágenes", color: "bg-purple-500 hover:bg-purple-600", url: "/imagenes" },
    { label: "Documentos", color: "bg-orange-500 hover:bg-orange-600", url: "/documentos" },
    { label: "Presupuestos denegados", color: "bg-red-600 hover:bg-red-700", url: "/presupuestos-denegados" },
    { label: "Trabajos finalizados", color: "bg-green-500 hover:bg-green-600", url: "/trabajos-finalizados" },
  ];

  const handleEnableNotifications = async () => {
    try {
      if (!auth.currentUser) return alert("No hay usuario logueado.");
      setPushStatus("working");
      const token = await registerPushForUser(auth.currentUser.uid, { email: auth.currentUser.email || "" }, { requestPermission: true });
      if (!token) { setPushStatus("idle"); return alert("No se pudo activar push (permiso denegado o sin VAPID key)."); }
      setPushStatus("enabled");
      alert("✅ Notificaciones activadas.");
    } catch (err) {
      console.error("Error activando notificaciones:", err);
      setPushStatus("error");
      alert("Error activando notificaciones: " + (err?.message || err));
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthChecked(true); if (!u) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => {
      const rol = (p?.rol || "ADMIN").toUpperCase();
      setUserRol(rol);
      setOnlyMine(rol === "MECANICO");
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      registerPushForUser(user.uid, { email: user.email || "" }, { requestPermission: false })
        .then((token) => { if (token) setPushStatus("enabled"); })
        .catch((e) => console.warn("Auto-register push falló:", e));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const uid = user.uid;
      const results = await Promise.all((items || []).map(async (it) => {
        const trabajoId = String(it.id);
        try {
          const chatSnap = await getDoc(doc(db, "chats_trabajos", trabajoId));
          if (!chatSnap.exists()) return [trabajoId, false];
          const chat = chatSnap.data() || {};
          const updatedMs = chat.updatedAt?.toMillis?.() || (chat.updatedAt?.seconds ? chat.updatedAt.seconds * 1000 : 0) || 0;
          const readSnap = await getDoc(doc(db, "chats_trabajos", trabajoId, "reads", uid));
          const lastReadMs = readSnap.exists() ? readSnap.data()?.lastReadAt?.toMillis?.() || 0 : 0;
          return [trabajoId, !!(updatedMs > lastReadMs && chat.lastSenderUid && chat.lastSenderUid !== uid)];
        } catch { return [trabajoId, false]; }
      }));
      if (!alive) return;
      const map = {}; results.forEach(([id, v]) => (map[id] = v)); setUnreadMap(map);
    })();
    return () => { alive = false; };
  }, [items, user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"), orderBy("creadoEn", "desc"));
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, datos: d.data().datos || {}, creadoEn: d.data().creadoEn, asignadoMecanicoUid: d.data().asignadoMecanicoUid || null, asignadoMecanicoNombre: d.data().asignadoMecanicoNombre || null }));
      if (userRol === "MECANICO" && onlyMine) setItems(list.filter((it) => it.asignadoMecanicoUid === user.uid));
      else setItems(list);
    });
  }, [user, userRol, onlyMine]);

  useEffect(() => {
    if (!user || !esAsesor) return;
    let alive = true;
    (async () => {
      try {
        const [pend, fin, den, agenda, notif, chats] = await Promise.all([
          getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"))),
          getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "FINALIZADO"))),
          getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "DENEGADO"))),
          getDocs(collection(db, "agenda_mecanicos")),
          getDocs(collection(db, "notificaciones")),
          getDocs(collection(db, "chats_trabajos")),
        ]);
        const hoy = new Date();
        const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
        const agendaHoy = agenda.docs.map((d) => d.data() || {}).filter((t) => {
          const f = toDate(t.fechaInicio); if (!f) return false;
          return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}` === hoyStr;
        });
        if (!alive) return;
        setStats({
          pendientes: pend.size,
          finalizados: fin.size,
          denegados: den.size,
          agendaHoy: agendaHoy.length,
          agendaPendiente: agendaHoy.filter((t) => !t.estado || t.estado === "pendiente").length,
          agendaProceso: agendaHoy.filter((t) => t.estado === "en_proceso").length,
          avisos: notif.docs.filter((d) => !d.data()?.leida).length,
          chatsNuevos: chats.docs.filter((d) => d.data()?.lastSenderUid && d.data()?.lastSenderUid !== user.uid).length,
        });
      } catch (e) { console.error("Error cargando panel estadísticas:", e); }
    })();
    return () => { alive = false; };
  }, [user, esAsesor]);

  const handleDelete = async (id) => {
    const clave = prompt("Para borrar este cuestionario, introduce la clave de confirmación:");
    if (clave !== CONFIRM_KEY) return alert("Clave incorrecta. No se ha borrado nada.");
    if (!confirm("¿Estás seguro de que quieres eliminar este cuestionario?")) return;
    const borrarChecklist = confirm("¿Quieres eliminar también la checklist asociada (si existe)?");
    const borrarRecambios = confirm("¿Quieres eliminar también los recambios asociados (si existe)?");
    try {
      await deleteChatTrabajo(db, id);
      if (borrarChecklist) { try { await deleteDoc(doc(db, "checklists", id)); } catch {} }
      if (borrarRecambios) { try { await deleteDoc(doc(db, "recambios", id)); } catch {} }
      await deleteDoc(doc(db, "cuestionarios_cliente", id));
      alert("Cuestionario y elementos asociados eliminados correctamente.");
    } catch (err) { console.error(err); alert("Ocurrió un error al eliminar."); }
  };

  const handleRejectPresupuesto = async (id) => {
    const clave = prompt("Para denegar presupuesto, introduce la clave:");
    if (clave !== CONFIRM_DENY_KEY) return alert("Clave incorrecta. Operación cancelada.");
    try {
      await deleteChatTrabajo(db, id);
      await updateDoc(doc(db, "cuestionarios_cliente", id), { estadoPresupuesto: "DENEGADO", fechaDenegado: serverTimestamp() });
      try { await updateDoc(doc(db, "checklists", id), { estadoPresupuesto: "DENEGADO", fechaDenegado: serverTimestamp() }); } catch {}
      try { await updateDoc(doc(db, "recambios", id), { estadoPresupuesto: "DENEGADO", fechaDenegado: serverTimestamp() }); } catch {}
      setItems((prev) => prev.filter((it) => it.id !== id));
      alert("Presupuesto denegado correctamente.");
    } catch (err) { console.error(err); alert("Error al denegar presupuesto: " + err.message); }
  };

  const handleFinalizar = async (id) => {
    const clave = prompt("Introduce la clave para finalizar este trabajo:");
    if (clave !== CONFIRM_FINISH_KEY) return alert("Clave incorrecta. No se ha finalizado nada.");
    try {
      await deleteChatTrabajo(db, id);
      await updateDoc(doc(db, "cuestionarios_cliente", id), { estadoPresupuesto: "FINALIZADO", fechaFinalizado: serverTimestamp() });
      try { await updateDoc(doc(db, "checklists", id), { estadoPresupuesto: "FINALIZADO", fechaFinalizado: serverTimestamp() }); } catch {}
      try { await updateDoc(doc(db, "recambios", id), { estadoPresupuesto: "FINALIZADO", fechaFinalizado: serverTimestamp() }); } catch {}
      setItems((prev) => prev.filter((item) => item.id !== id));
      alert("Trabajo finalizado correctamente.");
    } catch (err) { console.error("Error al finalizar trabajo:", err); alert("Error al finalizar el trabajo: " + err.message); }
  };

  const handleSignOut = async () => { await signOut(auth); router.replace("/login"); };
  if (!authChecked) return <p className="p-6 text-center">Comprobando sesión…</p>;

  const filteredItems = items.filter(({ datos }) => [datos?.matricula, datos?.numeroOR, datos?.nombreCliente, datos?.marcaModelo].filter(Boolean).join(" ").toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <main className="p-3 sm:p-6 space-y-6 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="min-w-0"><h1 className="text-3xl font-bold">Dashboard</h1><p className="mt-1 text-gray-600 break-words">Bienvenido, {user?.email}</p></div>
          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <button onClick={handleEnableNotifications} disabled={pushStatus === "working"} className={`w-full sm:w-auto px-4 py-3 rounded-lg border-2 border-black shadow-lg transition font-semibold ${pushStatus === "enabled" ? "bg-green-500 text-black hover:bg-green-600" : "bg-yellow-400 text-black hover:bg-yellow-500"}`} title="Activa notificaciones push para avisos de chat">{pushStatus === "working" ? "🔔 Activando..." : pushStatus === "enabled" ? "🔔 Notificaciones ON" : "🔔 Activar notificaciones"}</button>
            <button onClick={handleSignOut} className="w-full sm:w-auto px-4 py-3 bg-red-500 text-black border-2 border-black rounded-lg shadow-lg hover:bg-red-600 transition font-semibold">✖︎ Salir</button>
          </div>
        </header>

        {esAsesor && (
          <section className="mb-6 sm:mb-8 bg-white rounded-xl shadow p-4 sm:p-5 border border-blue-100">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-4">
              <div><h2 className="text-2xl font-bold">Panel Estadísticas</h2><p className="text-gray-600 text-sm">Resumen rápido solo para asesores y administradores.</p></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto"><button onClick={() => router.push("/notificaciones")} className="bg-amber-600 text-white px-4 py-3 rounded font-semibold">Notificaciones</button><button onClick={() => router.push("/agenda-mecanicos")} className="bg-purple-600 text-white px-4 py-3 rounded font-semibold">Agenda Mecánicos</button></div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-yellow-50 border rounded p-3"><p className="text-xs text-gray-500">Pendientes</p><b className="text-2xl">{stats.pendientes}</b></div>
              <div className="bg-blue-50 border rounded p-3"><p className="text-xs text-gray-500">Agenda hoy</p><b className="text-2xl">{stats.agendaHoy}</b><p className="text-xs text-gray-500">{stats.agendaPendiente} pendientes · {stats.agendaProceso} en proceso</p></div>
              <div className="bg-amber-50 border rounded p-3"><p className="text-xs text-gray-500">Avisos internos</p><b className="text-2xl">{stats.avisos}</b></div>
              <div className="bg-green-50 border rounded p-3"><p className="text-xs text-gray-500">Finalizados</p><b className="text-2xl">{stats.finalizados}</b></div>
              <div className="bg-red-50 border rounded p-3"><p className="text-xs text-gray-500">Denegados</p><b className="text-2xl">{stats.denegados}</b></div>
              <div className="bg-fuchsia-50 border rounded p-3"><p className="text-xs text-gray-500">Chats con actividad</p><b className="text-2xl">{stats.chatsNuevos}</b></div>
              <button onClick={() => router.push("/trabajos-finalizados")} className="bg-green-600 text-white rounded p-3 text-left min-h-[74px]"><p className="text-xs opacity-90">Ir a</p><b>Trabajos finalizados</b></button>
              <button onClick={() => router.push("/chats/informes")} className="bg-fuchsia-600 text-white rounded p-3 text-left min-h-[74px]"><p className="text-xs opacity-90">Ir a</p><b>Informes chats</b></button>
            </div>
          </section>
        )}

        <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6 sm:mb-8">
          {menuPrincipal.map((item) => (
            <button key={item.url} onClick={() => router.push(item.url)} className={`${item.color} text-white px-3 py-3 rounded-lg font-semibold text-sm sm:text-base min-h-[56px] shadow flex items-center justify-center text-center leading-tight break-words`}>
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      <section className="mt-6 sm:mt-8 space-y-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold">Cuestionarios guardados</h2>
        <div className="relative mb-4"><input type="text" placeholder="🔍 Buscar matrícula, nº OR o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-4 sm:pl-10 pr-4 py-3 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300" /></div>
        {userRol === "MECANICO" && <div className="mb-4 flex items-center gap-2 text-sm text-gray-700"><input id="onlyMine" type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /><label htmlFor="onlyMine">Ver sólo mis trabajos asignados</label></div>}
        {filteredItems.length === 0 ? <p className="text-gray-600">No hay cuestionarios que coincidan.</p> : filteredItems.map(({ id, datos, creadoEn }) => <div key={id} className="bg-white p-4 rounded-xl shadow border border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4"><div className="min-w-0"><p className="font-medium flex items-center flex-wrap gap-2 text-lg md:text-base"><span className="break-words">{datos.matricula} — {datos.numeroOR} — {datos.nombreCliente || ""}</span>{unreadMap?.[id] ? <span className="inline-flex items-center gap-2 px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white">● NUEVO MENSAJE</span> : null}</p><p className="text-sm text-gray-500">Creado: {fechaTexto(creadoEn)}</p></div><div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto md:min-w-[420px]"><button onClick={() => router.push(`/chat-trabajo/${encodeURIComponent(id)}`)} className="px-3 py-2 rounded bg-fuchsia-600 text-white font-semibold">Chat</button><button onClick={() => router.push(`/cliente-form/${encodeURIComponent(id)}?view=true`)} className="px-3 py-2 rounded bg-indigo-600 text-white font-semibold">Ver</button><button onClick={() => router.push(`/cliente-form/${encodeURIComponent(id)}?edit=true`)} className="px-3 py-2 rounded bg-pink-500 text-white font-semibold">Editar</button><button onClick={() => handleRejectPresupuesto(id)} className="px-3 py-2 rounded bg-yellow-500 text-white font-semibold col-span-2 sm:col-span-1">Rechazar</button><button onClick={() => handleFinalizar(id)} className="px-3 py-2 rounded bg-green-600 text-white font-semibold">Finalizar</button><button onClick={() => handleDelete(id)} className="px-3 py-2 rounded bg-red-600 text-white font-semibold">Eliminar</button></div></div>)}
      </section>
    </main>
  );
}
