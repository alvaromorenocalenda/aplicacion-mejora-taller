// app/chats/informes/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { subscribeUserProfile } from "../../../lib/userProfile";

function pad(n) { return String(n).padStart(2, "0"); }
function todayIso() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function formatFecha(ts) { try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("es-ES") : ""; } catch { return ""; } }
function formatHora(ts) { try { const d = ts?.toDate ? ts.toDate() : new Date(ts); return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : ""; } catch { return ""; } }
function buildDateTime(fecha, hora, fallbackHora) { return new Date(`${fecha || todayIso()}T${hora || fallbackHora}:00`); }
function csvEscape(value) { const v = String(value ?? ""); return `"${v.replaceAll('"', '""')}"`; }

export default function InformesChatsPage() {
  const router = useRouter();
  const hoy = useMemo(() => todayIso(), []);
  const [user, setUser] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [checking, setChecking] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(hoy);
  const [horaDesde, setHoraDesde] = useState("10:00");
  const [fechaHasta, setFechaHasta] = useState(hoy);
  const [horaHasta, setHoraHasta] = useState("14:00");
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [indexUrl, setIndexUrl] = useState("");
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); if (!u) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => { setUserRol((p?.rol || "ADMIN").toUpperCase()); setChecking(false); });
  }, [user]);

  const permitido = userRol && userRol !== "MECANICO";

  async function buscarMensajes(e) {
    e?.preventDefault?.();
    setError("");
    setIndexUrl("");
    if (!permitido) return;
    const desde = buildDateTime(fechaDesde, horaDesde, "00:00");
    const hasta = buildDateTime(fechaHasta, horaHasta, "23:59");
    if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) return setError("Revisa las fechas y horas introducidas.");
    if (hasta < desde) return setError("La fecha/hora final no puede ser anterior a la inicial.");
    setLoading(true);
    setResultados([]);

    try {
      const q = query(collectionGroup(db, "messages"), where("createdAt", ">=", Timestamp.fromDate(desde)), where("createdAt", "<=", Timestamp.fromDate(hasta)), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      const cacheTrabajos = new Map();

      async function getTrabajo(trabajoId) {
        if (!trabajoId) return {};
        if (cacheTrabajos.has(trabajoId)) return cacheTrabajos.get(trabajoId);
        let info = { cuestionarioId: trabajoId };
        try {
          const chatSnap = await getDoc(doc(db, "chats_trabajos", trabajoId));
          if (chatSnap.exists()) {
            const data = chatSnap.data() || {};
            info = { ...info, matricula: data.matricula || "", numeroOR: data.numeroOR || "", nombreCliente: data.nombreCliente || "" };
          }
        } catch {}
        if (!info.matricula && !info.numeroOR && !info.nombreCliente) {
          try {
            const cuestionarioSnap = await getDoc(doc(db, "cuestionarios_cliente", trabajoId));
            if (cuestionarioSnap.exists()) {
              const datos = cuestionarioSnap.data()?.datos || {};
              info = { ...info, matricula: datos.matricula || "", numeroOR: datos.numeroOR || "", nombreCliente: datos.nombreCliente || "" };
            }
          } catch {}
        }
        cacheTrabajos.set(trabajoId, info);
        return info;
      }

      const rows = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() || {};
        const trabajoId = d.ref.parent?.parent?.id || data.cuestionarioId || "";
        const trabajo = await getTrabajo(String(trabajoId));
        return {
          id: d.id,
          trabajoId: String(trabajoId),
          fecha: data.createdAt || null,
          usuario: data.displayName || data.email || data.uid || "Usuario",
          texto: data.text || data.texto || (data.imageUrl ? "📷 Imagen" : ""),
          imageUrl: data.imageUrl || "",
          imageName: data.imageName || "",
          matricula: trabajo.matricula || "",
          numeroOR: trabajo.numeroOR || "",
          nombreCliente: trabajo.nombreCliente || "",
        };
      }));
      setResultados(rows);
    } catch (err) {
      console.error("Error generando informe de chats:", err);
      const mensajeError = String(err?.message || err || "");
      const enlaceIndice = mensajeError.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/i)?.[0] || "";
      if (enlaceIndice) { setIndexUrl(enlaceIndice); setError("Firebase necesita crear un índice para poder generar este informe."); }
      else setError("No se ha podido generar el informe. Revisa la consola del navegador por si Firebase muestra el enlace del índice.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (permitido) buscarMensajes(); }, [permitido]);

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return resultados;
    return resultados.filter((r) => [r.matricula, r.numeroOR, r.nombreCliente, r.usuario, r.texto, r.imageName, r.trabajoId].filter(Boolean).join(" ").toLowerCase().includes(t));
  }, [busqueda, resultados]);

  function descargarCSV() {
    const cabeceras = ["Fecha", "Hora", "Matricula", "Numero OR", "Cliente", "Usuario", "Mensaje", "Imagen", "ID trabajo"];
    const lineas = filtrados.map((r) => [formatFecha(r.fecha), formatHora(r.fecha), r.matricula, r.numeroOR, r.nombreCliente, r.usuario, r.texto, r.imageUrl || "", r.trabajoId]);
    const csv = [cabeceras, ...lineas].map((row) => row.map(csvEscape).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-chats-${fechaDesde}-${horaDesde.replace(":", "")}-${fechaHasta}-${horaHasta.replace(":", "")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (checking) return <main className="max-w-6xl mx-auto p-6"><p className="text-gray-600">Cargando permisos…</p></main>;
  if (!permitido) return <main className="max-w-4xl mx-auto p-6 space-y-4"><h1 className="text-3xl font-bold">Informes Chats</h1><div className="bg-white p-6 rounded shadow text-red-700 font-semibold">No tienes permiso para ver esta pantalla.</div><button onClick={() => router.push("/chats")} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Volver a Chats</button></main>;

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <style jsx global>{`@media print {.no-print { display: none !important; } body { background: white !important; } main { max-width: none !important; padding: 0 !important; } table { font-size: 11px; }}`}</style>
      <header className="flex justify-between items-center flex-wrap gap-3 no-print">
        <div><h1 className="text-3xl font-bold">Informes Chats</h1><p className="text-gray-600">Informe de mensajes escritos en los chats por rango de fecha y hora.</p></div>
        <div className="flex gap-2 flex-wrap"><button onClick={() => router.push("/chats")} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Volver a Chats</button><button onClick={() => router.push("/dashboard")} className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-800">Dashboard</button></div>
      </header>

      <form onSubmit={buscarMensajes} className="bg-white p-4 rounded shadow grid grid-cols-1 md:grid-cols-6 gap-3 items-end no-print">
        <div><label className="block text-sm font-semibold mb-1">Fecha desde</label><input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm font-semibold mb-1">Hora desde</label><input type="time" value={horaDesde} onChange={(e) => setHoraDesde(e.target.value)} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm font-semibold mb-1">Fecha hasta</label><input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm font-semibold mb-1">Hora hasta</label><input type="time" value={horaHasta} onChange={(e) => setHoraHasta(e.target.value)} className="w-full border rounded px-3 py-2" /></div>
        <div><label className="block text-sm font-semibold mb-1">Buscar texto</label><input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Matrícula, OR, usuario..." className="w-full border rounded px-3 py-2" /></div>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{loading ? "Buscando…" : "Buscar"}</button>
      </form>

      <section className="bg-white rounded shadow overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center flex-wrap gap-3">
          <div><h2 className="text-xl font-bold">Resultado del informe</h2><p className="text-sm text-gray-600">Desde {fechaDesde} {horaDesde} hasta {fechaHasta} {horaHasta} · {filtrados.length} mensajes</p></div>
          <div className="flex gap-2 no-print"><button type="button" onClick={descargarCSV} disabled={filtrados.length === 0} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">Descargar Excel/CSV</button><button type="button" onClick={() => window.print()} disabled={filtrados.length === 0} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">Imprimir / PDF</button></div>
        </div>
        {error ? <div className="m-4 p-4 bg-red-50 text-red-700 rounded border border-red-200 space-y-3"><p>{error}</p>{indexUrl ? <a href={indexUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-semibold">Crear índice en Firebase</a> : null}</div> : null}
        {loading ? <p className="p-4 text-gray-600">Cargando mensajes…</p> : filtrados.length === 0 ? <p className="p-4 text-gray-600">No hay mensajes en ese rango.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100"><tr><th className="text-left p-3 border-b">Fecha</th><th className="text-left p-3 border-b">Hora</th><th className="text-left p-3 border-b">Matrícula</th><th className="text-left p-3 border-b">Nº OR</th><th className="text-left p-3 border-b">Cliente</th><th className="text-left p-3 border-b">Usuario</th><th className="text-left p-3 border-b">Mensaje</th><th className="text-left p-3 border-b no-print">Acciones</th></tr></thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={`${r.trabajoId}-${r.id}`} className="hover:bg-gray-50 align-top">
                    <td className="p-3 border-b whitespace-nowrap">{formatFecha(r.fecha)}</td>
                    <td className="p-3 border-b whitespace-nowrap">{formatHora(r.fecha)}</td>
                    <td className="p-3 border-b font-semibold whitespace-nowrap">{r.matricula}</td>
                    <td className="p-3 border-b whitespace-nowrap">{r.numeroOR}</td>
                    <td className="p-3 border-b whitespace-nowrap">{r.nombreCliente}</td>
                    <td className="p-3 border-b whitespace-nowrap">{r.usuario}</td>
                    <td className="p-3 border-b whitespace-pre-wrap min-w-[360px]">{r.imageUrl ? <button type="button" onClick={() => window.open(r.imageUrl, "_blank")} className="mb-2 block no-print"><img src={r.imageUrl} alt={r.imageName || "Imagen"} className="max-h-24 rounded border" /></button> : null}{r.texto}<div className="text-[11px] text-gray-400 mt-1 no-print">ID trabajo: {r.trabajoId}</div></td>
                    <td className="p-3 border-b whitespace-nowrap no-print"><button onClick={() => router.push(`/chat-trabajo/${encodeURIComponent(r.trabajoId)}`)} className="px-3 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 text-xs font-semibold">Abrir chat</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
