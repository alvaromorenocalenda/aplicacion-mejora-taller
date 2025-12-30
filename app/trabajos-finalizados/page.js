"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc
} from "firebase/firestore";

import { deleteChatTrabajo } from "../../lib/chatCleanup";
import { subscribeUserProfile } from "../../lib/userProfile";

const CONFIRM_KEY = "CALENDABORRAR";

export default function TrabajosFinalizadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cuestionarios, setCuestionarios] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [recambios, setRecambios] = useState([]);

  const [searchCq, setSearchCq] = useState("");
  const [searchCh, setSearchCh] = useState("");
  const [searchR, setSearchR] = useState("");

  const [userRol, setUserRol] = useState("ADMIN");
  const [onlyMine, setOnlyMine] = useState(true);

  // ✅ Evita que el rol pise el checkbox tras que el usuario haga click
  const didInitOnlyMine = useRef(false);

  const matchTrabajo = (item, term) => {
    const t = (term || "").toLowerCase();
    return (
      (item?.datos?.matricula || "").toLowerCase().includes(t) ||
      (item?.datos?.numeroOR || "").toLowerCase().includes(t) ||
      (item?.datos?.nombreCliente || "").toLowerCase().includes(t)
    );
  };

  const trabajoLabel = (item) =>
    `${item?.datos?.matricula || ""} — ${item?.datos?.numeroOR || ""} — ${
      item?.datos?.nombreCliente || ""
    }`;

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    const u = auth.currentUser;
    const unsub = subscribeUserProfile(u.uid, (p) => {
      const rol = (p?.rol || "ADMIN").toUpperCase();
      setUserRol(rol);

      // Si NO es mecánico, siempre se desactiva (no tiene sentido el filtro)
      if (rol !== "MECANICO") {
        didInitOnlyMine.current = true;
        setOnlyMine(false);
        return;
      }

      // Si es mecánico, sólo poner el valor por defecto 1 vez
      if (!didInitOnlyMine.current) {
        didInitOnlyMine.current = true;
        setOnlyMine(true);
      }
    });
    (async () => {
      const [cqSnap, chSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "FINALIZADO"))),
        getDocs(query(collection(db, "checklists"), where("estadoPresupuesto", "==", "FINALIZADO"))),
        getDocs(query(collection(db, "recambios"), where("estadoPresupuesto", "==", "FINALIZADO")))
      ]);
      const cq = cqSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const ch = chSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const r  = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (userRol === "MECANICO" && onlyMine) {
        const allowed = new Set(cq.filter(x => x.asignadoMecanicoUid === u.uid).map(x => x.id));
        setCuestionarios(cq.filter(x => allowed.has(x.id)));
        setChecklists(ch.filter(x => allowed.has(x.id)));
        setRecambios(r.filter(x => allowed.has(x.id)));
      } else {
        setCuestionarios(cq);
        setChecklists(ch);
        setRecambios(r);
      }
      setLoading(false);
    })();
    return () => unsub && unsub();
  }, [router, userRol, onlyMine]);

  const confirmAndDeleteAll = async (itemId) => {
    const clave = prompt("Introduce la clave de confirmación para borrar:");
    if (clave !== CONFIRM_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }

    // Borrar chat asociado (si existe)
    await deleteChatTrabajo(db, itemId);
    if (confirm("¿Deseas borrar el cuestionario cliente asociado?")) {
      await deleteDoc(doc(db, "cuestionarios_cliente", itemId));
      setCuestionarios(prev => prev.filter(c => c.id !== itemId));
    }
    if (confirm("¿Deseas borrar la checklist asociada?")) {
      await deleteDoc(doc(db, "checklists", itemId));
      setChecklists(prev => prev.filter(c => c.id !== itemId));
    }
    if (confirm("¿Deseas borrar los recambios asociados?")) {
      await deleteDoc(doc(db, "recambios", itemId));
      setRecambios(prev => prev.filter(c => c.id !== itemId));
    }
  };

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Trabajos Finalizados</h1>
      <button
        onClick={() => router.push("/dashboard")}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        ← Volver al Dashboard
      </button>

      {userRol === "MECANICO" && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <input
            id="onlyMineFin"
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          <label htmlFor="onlyMineFin">Ver sólo mis trabajos asignados</label>
        </div>
      )}

      <section>
        <h2 className="text-2xl font-semibold mb-4">Cuestionarios Cliente</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula, número de orden o nombre..."
            value={searchCq}
            onChange={e => setSearchCq(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        {cuestionarios.filter(c => matchTrabajo(c, searchCq)).length === 0 ? (
          <p className="text-gray-600">No hay cuestionarios finalizados.</p>
        ) : (
          cuestionarios.filter(c => matchTrabajo(c, searchCq)).map(c => {
            return (
              <div key={c.id} className="flex justify-between items-center bg-green-100 p-4 mb-2 rounded">
                <p className="font-medium">{trabajoLabel(c)}</p>
                <div className="space-x-2">
                  <button
                    onClick={() => router.push(`/chat-trabajo/${c.id}`)}
                    className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                  >Chat</button>
                  <button
                    onClick={() => router.push(`/cliente-form/${c.id}?view=true`)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >Ver</button>
                  <button
                    onClick={() => confirmAndDeleteAll(c.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >Eliminar</button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Checklists</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula, número de orden o nombre..."
            value={searchCh}
            onChange={e => setSearchCh(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        {checklists.filter(c => matchTrabajo(c, searchCh)).length === 0 ? (
          <p className="text-gray-600">No hay checklists finalizadas.</p>
        ) : (
          checklists.filter(c => matchTrabajo(c, searchCh)).map(c => {
            return (
              <div key={c.id} className="flex justify-between items-center bg-green-100 p-4 mb-2 rounded">
                <p className="font-medium">{trabajoLabel(c)}</p>
                <div className="space-x-2">
                  <button
                    onClick={() => router.push(`/chat-trabajo/${c.id}`)}
                    className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                  >Chat</button>
                  <button
                    onClick={() => router.push(`/diagnostico-form/${c.id}/detalle`)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >Ver</button>
                  <button
                    onClick={() => confirmAndDeleteAll(c.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >Eliminar</button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Recambios</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula, número de orden o nombre..."
            value={searchR}
            onChange={e => setSearchR(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-green-500 focus:outline-none focus:ring-2 focus:ring-green-300"
          />
        </div>
        {recambios.filter(c => matchTrabajo(c, searchR)).length === 0 ? (
          <p className="text-gray-600">No hay recambios finalizados.</p>
        ) : (
          recambios.filter(c => matchTrabajo(c, searchR)).map(c => {
            return (
              <div key={c.id} className="flex justify-between items-center bg-green-100 p-4 mb-2 rounded">
                <p className="font-medium">{trabajoLabel(c)}</p>
                <div className="space-x-2">
                  <button
                    onClick={() => router.push(`/chat-trabajo/${c.id}`)}
                    className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                  >Chat</button>
                  <button
                    onClick={() => router.push(`/recambios-form/${c.id}/detalle`)}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >Ver</button>
                  <button
                    onClick={() => confirmAndDeleteAll(c.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >Eliminar</button>
                </div>
              </div>
            );
          })
        )}
      </section>
    </main>
  );
}
