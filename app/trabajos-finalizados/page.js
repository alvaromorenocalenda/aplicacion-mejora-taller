"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { deleteChatTrabajo } from "../../lib/chatCleanup";
import { subscribeUserProfile } from "../../lib/userProfile";

const CONFIRM_KEY = "CALENDABORRAR";
const pad = (n) => String(n).padStart(2, "0");
const mesActual = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const toDate = (v) => v?.toDate?.() ? v.toDate() : v ? new Date(v) : null;
const fechaTexto = (v) => { const d = toDate(v); return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("es-ES") : "Sin fecha"; };
const fechaFiltro = (item) => toDate(item.fechaFinalizado || item.finalizadoEn || item.actualizadoEn || item.creadoEn || item.createdAt || item.updatedAt);
const datosObjeto = (d) => d && typeof d === "object" && !Array.isArray(d) ? d : {};
const enMes = (item, mes) => { if (!mes) return true; const d = fechaFiltro(item); if (!d || Number.isNaN(d.getTime())) return false; return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` === mes; };

export default function TrabajosFinalizadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cuestionarios, setCuestionarios] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [recambios, setRecambios] = useState([]);
  const [chats, setChats] = useState([]);
  const [searchCq, setSearchCq] = useState("");
  const [searchCh, setSearchCh] = useState("");
  const [searchR, setSearchR] = useState("");
  const [searchChat, setSearchChat] = useState("");
  const [mes, setMes] = useState(mesActual());
  const [userRol, setUserRol] = useState("ADMIN");
  const [onlyMine, setOnlyMine] = useState(true);
  const didInitOnlyMine = useRef(false);

  const irASeccion = (id) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); window.history.replaceState(null, "", `#${id}`); };
  const matchTrabajo = (item, term) => { const t = (term || "").toLowerCase(); const d = datosObjeto(item?.datos); return (d?.matricula || "").toLowerCase().includes(t) || (d?.numeroOR || "").toLowerCase().includes(t) || (d?.nombreCliente || d?.nombre || "").toLowerCase().includes(t); };
  const trabajoLabel = (item) => { const d = datosObjeto(item?.datos); return `${d?.matricula || "Sin matrícula"} — ${d?.numeroOR || "Sin OR"} — ${d?.nombreCliente || d?.nombre || "Sin cliente"}`; };

  function completarDatosRelacionados(cq, ch, r) {
    const cuestionariosMap = new Map(cq.map((x) => [x.id, x]));
    const checklistsMap = new Map(ch.map((x) => [x.id, x]));
    const checklistsCompletas = ch.map((x) => { const cuestionarioId = x.cuestionarioId || x.id; const cuestionario = cuestionariosMap.get(cuestionarioId) || {}; return { ...x, cuestionarioId, datos: { ...datosObjeto(cuestionario.datos), ...datosObjeto(x.datos) } }; });
    const recambiosCompletos = r.map((x) => { const checklistId = x.checklistId || x.id; const checklist = checklistsMap.get(checklistId) || {}; const cuestionarioId = x.cuestionarioId || checklist.cuestionarioId || checklistId || x.id; const cuestionario = cuestionariosMap.get(cuestionarioId) || cuestionariosMap.get(x.id) || {}; return { ...x, checklistId, cuestionarioId, datos: { ...datosObjeto(cuestionario.datos), ...datosObjeto(checklist.datos), ...datosObjeto(x.datos) } }; });
    return { checklistsCompletas, recambiosCompletos };
  }

  function construirChatsAsociados(cq, chCompletas, rCompletos, chatList) {
    const chatMap = new Map(chatList.map((x) => [x.id, x]));
    const rows = new Map();
    const add = (cuestionarioId, datos, extra = {}) => {
      const id = cuestionarioId || extra.id;
      if (!id || rows.has(id)) return;
      const chat = chatMap.get(id) || {};
      rows.set(id, { ...extra, ...chat, id, cuestionarioId: id, datos: { ...datosObjeto(datos), ...datosObjeto(chat.datos) }, tieneChatGuardado: !!chatMap.get(id) });
    };
    cq.forEach((x) => add(x.id, x.datos, x));
    chCompletas.forEach((x) => add(x.cuestionarioId || x.id, x.datos, x));
    rCompletos.forEach((x) => add(x.cuestionarioId || x.id, x.datos, x));
    return Array.from(rows.values());
  }

  useEffect(() => {
    if (!auth.currentUser) { router.replace("/login"); return; }
    const u = auth.currentUser;
    const unsub = subscribeUserProfile(u.uid, (p) => { const rol = (p?.rol || "ADMIN").toUpperCase(); setUserRol(rol); if (rol !== "MECANICO") { didInitOnlyMine.current = true; setOnlyMine(false); return; } if (!didInitOnlyMine.current) { didInitOnlyMine.current = true; setOnlyMine(true); } });
    (async () => {
      setLoading(true);
      const [cqSnap, chSnap, rSnap, chatSnap] = await Promise.all([
        getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "FINALIZADO"))),
        getDocs(query(collection(db, "checklists"), where("estadoPresupuesto", "==", "FINALIZADO"))),
        getDocs(query(collection(db, "recambios"), where("estadoPresupuesto", "==", "FINALIZADO"))),
        getDocs(collection(db, "chats_trabajos"))
      ]);
      const cq = cqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ch = chSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const r = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const chatList = chatSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const { checklistsCompletas, recambiosCompletos } = completarDatosRelacionados(cq, ch, r);
      const chatsAsociados = construirChatsAsociados(cq, checklistsCompletas, recambiosCompletos, chatList);
      if (userRol === "MECANICO" && onlyMine) {
        const allowed = new Set(cq.filter(x => x.asignadoMecanicoUid === u.uid).map(x => x.id));
        setCuestionarios(cq.filter(x => allowed.has(x.id))); setChecklists(checklistsCompletas.filter(x => allowed.has(x.cuestionarioId || x.id))); setRecambios(recambiosCompletos.filter(x => allowed.has(x.cuestionarioId || x.id))); setChats(chatsAsociados.filter(x => allowed.has(x.cuestionarioId || x.id)));
      } else { setCuestionarios(cq); setChecklists(checklistsCompletas); setRecambios(recambiosCompletos); setChats(chatsAsociados); }
      setLoading(false);
    })();
    return () => unsub && unsub();
  }, [router, userRol, onlyMine]);

  const handleDeleteChat = async (trabajoId) => {
    const clave = prompt("Introduce la clave para borrar SOLO el chat:");
    if (clave !== CONFIRM_KEY) return alert("Clave incorrecta. Operación cancelada.");
    if (!confirm("¿Seguro que quieres borrar el chat asociado a este trabajo? El trabajo NO se borrará.")) return;
    try {
      await deleteChatTrabajo(db, trabajoId);
      setChats((prev) => prev.map((c) => (String(c.cuestionarioId || c.id) === String(trabajoId) ? { ...c, tieneChatGuardado: false, lastMessage: "", lastText: "", updatedAt: null, createdAt: null } : c)));
      alert("Chat eliminado correctamente.");
    } catch (err) { console.error(err); alert("Error al borrar el chat: " + (err?.message || err)); }
  };

  const confirmAndDeleteAll = async (itemId) => {
    const clave = prompt("Introduce la clave de confirmación para borrar:");
    if (clave !== CONFIRM_KEY) return alert("Clave incorrecta. Operación cancelada.");
    await deleteChatTrabajo(db, itemId);
    if (confirm("¿Deseas borrar el cuestionario cliente asociado?")) { await deleteDoc(doc(db, "cuestionarios_cliente", itemId)); setCuestionarios(prev => prev.filter(c => c.id !== itemId)); }
    if (confirm("¿Deseas borrar la checklist asociada?")) { await deleteDoc(doc(db, "checklists", itemId)); setChecklists(prev => prev.filter(c => c.id !== itemId)); }
    if (confirm("¿Deseas borrar los recambios asociados?")) { await deleteDoc(doc(db, "recambios", itemId)); setRecambios(prev => prev.filter(c => c.id !== itemId)); }
    setChats(prev => prev.filter(c => String(c.cuestionarioId || c.id) !== String(itemId)));
  };

  const cqFiltrados = useMemo(() => cuestionarios.filter(c => enMes(c, mes) && matchTrabajo(c, searchCq)), [cuestionarios, mes, searchCq]);
  const chFiltrados = useMemo(() => checklists.filter(c => enMes(c, mes) && matchTrabajo(c, searchCh)), [checklists, mes, searchCh]);
  const rFiltrados = useMemo(() => recambios.filter(c => enMes(c, mes) && matchTrabajo(c, searchR)), [recambios, mes, searchR]);
  const chatsFiltrados = useMemo(() => chats.filter(c => enMes(c, mes) && (matchTrabajo(c, searchChat) || String(c.lastMessage || c.lastText || "").toLowerCase().includes(searchChat.toLowerCase()))), [chats, mes, searchChat]);
  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  const renderItem = (c, tipo) => {
    const cuestionarioId = c.cuestionarioId || c.id;
    const rutaVer = tipo === "cliente" ? `/cliente-form/${encodeURIComponent(c.id)}?view=true` : tipo === "checklist" ? `/diagnostico-form/${encodeURIComponent(c.id)}/detalle` : `/recambios-form/${encodeURIComponent(c.id)}/detalle`;
    return <div key={`${tipo}-${c.id}`} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-green-100 p-4 mb-2 rounded gap-3"><div><p className="font-medium">{trabajoLabel(c)}</p><p className="text-xs text-gray-600">Finalizado/fecha: {fechaTexto(fechaFiltro(c))}</p></div><div className="grid grid-cols-2 gap-2 sm:flex sm:space-x-2 sm:whitespace-nowrap"><button onClick={() => router.push(`/chat-trabajo/${encodeURIComponent(cuestionarioId)}`)} className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700">Chat</button><button onClick={() => handleDeleteChat(cuestionarioId)} className="px-3 py-1 bg-rose-700 text-white rounded hover:bg-rose-800">Eliminar chat</button><button onClick={() => router.push(rutaVer)} className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Ver</button><button onClick={() => confirmAndDeleteAll(cuestionarioId)} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Eliminar</button></div></div>;
  };

  const renderChat = (c) => {
    const cuestionarioId = c.cuestionarioId || c.id;
    return <div key={`chat-${c.id}`} className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-fuchsia-50 border border-fuchsia-200 p-4 mb-2 rounded gap-3"><div><p className="font-medium">{trabajoLabel(c)}</p><p className="text-xs text-gray-600">Última actividad: {c.tieneChatGuardado ? fechaTexto(c.updatedAt || c.createdAt) : "Sin mensajes todavía"}</p><p className="text-sm text-gray-700 truncate max-w-xl">{c.lastMessage || c.lastText || "Chat asociado al trabajo"}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => router.push(`/chat-trabajo/${encodeURIComponent(cuestionarioId)}`)} className="px-3 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700">Abrir chat</button><button onClick={() => handleDeleteChat(cuestionarioId)} className="px-3 py-2 bg-rose-700 text-white rounded hover:bg-rose-800">Eliminar chat</button></div></div>;
  };

  return <main className="max-w-5xl mx-auto p-6 space-y-8">
    <div className="flex justify-between items-center gap-3 flex-wrap"><div><h1 className="text-3xl font-bold">Trabajos Finalizados</h1><p className="text-gray-600">Por defecto se muestran los trabajos del mes actual.</p></div><button onClick={() => router.push("/dashboard")} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">← Volver al Dashboard</button></div>
    <div className="flex flex-wrap gap-3 bg-white rounded-xl shadow p-4 items-end sticky top-3 z-10"><button onClick={() => irASeccion("cuestionarios-finalizados")} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Ir a cuestionarios cliente</button><button onClick={() => irASeccion("checklists-finalizadas")} className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600">Ir a checklist finalizadas</button><button onClick={() => irASeccion("recambios-finalizados")} className="px-4 py-2 bg-blue-800 text-white rounded hover:bg-blue-900">Ir a recambios finalizados</button><button onClick={() => irASeccion("chats-finalizados")} className="px-4 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700">Ir a chats asociados</button><label className="ml-auto text-sm font-semibold">Filtro por mes<input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="block border rounded px-3 py-2 mt-1" /></label><button onClick={() => setMes(mesActual())} className="px-4 py-2 bg-green-600 text-white rounded">Mes actual</button><button onClick={() => setMes("")} className="px-4 py-2 bg-gray-600 text-white rounded">Ver todos</button></div>
    {userRol === "MECANICO" && <div className="flex items-center gap-2 text-sm text-gray-700"><input id="onlyMineFin" type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} /><label htmlFor="onlyMineFin">Ver sólo mis trabajos asignados</label></div>}
    <section id="cuestionarios-finalizados" className="scroll-mt-28"><h2 className="text-2xl font-semibold mb-4">Cuestionarios Cliente ({cqFiltrados.length})</h2><input type="text" placeholder="🔍 Buscar matrícula, número de orden o nombre..." value={searchCq} onChange={e => setSearchCq(e.target.value)} className="w-full mb-4 pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300" />{cqFiltrados.length === 0 ? <p className="text-gray-600">No hay cuestionarios finalizados en este periodo.</p> : cqFiltrados.map(c => renderItem(c, "cliente"))}</section>
    <section id="checklists-finalizadas" className="scroll-mt-28"><h2 className="text-2xl font-semibold mb-4">Checklists ({chFiltrados.length})</h2><input type="text" placeholder="🔍 Buscar matrícula, número de orden o nombre..." value={searchCh} onChange={e => setSearchCh(e.target.value)} className="w-full mb-4 pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300" />{chFiltrados.length === 0 ? <p className="text-gray-600">No hay checklists finalizadas en este periodo.</p> : chFiltrados.map(c => renderItem(c, "checklist"))}</section>
    <section id="recambios-finalizados" className="scroll-mt-28"><h2 className="text-2xl font-semibold mb-4">Recambios ({rFiltrados.length})</h2><input type="text" placeholder="🔍 Buscar matrícula, número de orden o nombre..." value={searchR} onChange={e => setSearchR(e.target.value)} className="w-full mb-4 pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300" />{rFiltrados.length === 0 ? <p className="text-gray-600">No hay recambios finalizados en este periodo.</p> : rFiltrados.map(c => renderItem(c, "recambios"))}</section>
    <section id="chats-finalizados" className="scroll-mt-28"><h2 className="text-2xl font-semibold mb-4">Chats asociados ({chatsFiltrados.length})</h2><input type="text" placeholder="🔍 Buscar matrícula, número de orden, nombre o texto del chat..." value={searchChat} onChange={e => setSearchChat(e.target.value)} className="w-full mb-4 pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-300" />{chatsFiltrados.length === 0 ? <p className="text-gray-600">No hay chats asociados en este periodo.</p> : chatsFiltrados.map(renderChat)}</section>
  </main>;
}
