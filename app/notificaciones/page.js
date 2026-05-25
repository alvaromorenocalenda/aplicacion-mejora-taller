"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { subscribeUserProfile } from "@/lib/userProfile";

const toDate = (v) => v?.toDate?.() ? v.toDate() : v ? new Date(v) : null;
const fechaTexto = (v) => {
  const d = toDate(v);
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Sin fecha";
};

export default function NotificacionesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [rol, setRol] = useState(null);
  const [notificaciones, setNotificaciones] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const snap = await getDocs(query(collection(db, "notificaciones"), orderBy("creadoEn", "desc")));
      setNotificaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      alert("No se han podido cargar las notificaciones.");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (permitido) cargar(); }, [permitido]);

  async function marcarLeida(n) {
    try {
      await updateDoc(doc(db, "notificaciones", n.id), { leida: true, leidaEn: serverTimestamp(), leidaPorUid: user?.uid || "" });
      setNotificaciones((prev) => prev.map((x) => x.id === n.id ? { ...x, leida: true } : x));
    } catch (e) { console.error(e); }
  }

  if (!rol) return <main className="p-6 max-w-5xl mx-auto">Cargando permisos...</main>;
  if (!permitido) return <main className="p-6 max-w-4xl mx-auto"><h1 className="text-3xl font-bold mb-4">Notificaciones</h1><div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">Esta pantalla es solo para asesores y administradores.</div></main>;

  return <main className="min-h-screen bg-gray-100 p-6">
    <div className="max-w-5xl mx-auto space-y-5">
      <header className="flex justify-between items-center gap-3 flex-wrap">
        <div><h1 className="text-3xl font-bold">Notificaciones internas</h1><p className="text-gray-600">Avisos generados desde chats, agenda y trabajos.</p></div>
        <div className="flex gap-2"><button onClick={cargar} className="bg-blue-700 text-white px-4 py-2 rounded">Actualizar</button><button onClick={() => router.push("/dashboard-asesores")} className="bg-gray-700 text-white px-4 py-2 rounded">Dashboard control</button></div>
      </header>
      <section className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? <p className="p-4">Cargando...</p> : notificaciones.length === 0 ? <p className="p-4 text-gray-500">No hay notificaciones.</p> : notificaciones.map((n) => <div key={n.id} className={`p-4 border-b flex justify-between gap-4 ${n.leida ? "bg-white" : "bg-amber-50"}`}>
          <div><h2 className="font-bold">{n.titulo || "Aviso"}</h2><p className="text-sm text-gray-700">{n.mensaje || ""}</p><p className="text-xs text-gray-500 mt-1">{fechaTexto(n.creadoEn)} · {n.matricula || ""} {n.numeroOR ? `· OR ${n.numeroOR}` : ""}</p></div>
          <div className="flex flex-col gap-2 min-w-[120px]"><button onClick={() => marcarLeida(n)} className="bg-green-600 text-white px-3 py-1 rounded text-sm">Leída</button>{n.url ? <button onClick={() => { marcarLeida(n); router.push(n.url); }} className="bg-pink-600 text-white px-3 py-1 rounded text-sm">Abrir</button> : null}</div>
        </div>)}
      </section>
    </div>
  </main>;
}
