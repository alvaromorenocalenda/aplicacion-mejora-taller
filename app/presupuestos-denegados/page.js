// app/presupuestos-denegados/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import { deleteChatTrabajo } from "../../lib/chatCleanup";

// clave para confirmar borrado
const CONFIRM_KEY = "CALENDABORRAR";
// clave para reabrir presupuesto
const REOPEN_KEY = "CALENDAREABRIR";

export default function PresupuestosDenegadosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cuestionarios, setCuestionarios] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [recambios, setRecambios] = useState([]);

  // estados de búsqueda para cada sección
  const [searchCq, setSearchCq] = useState("");
  const [searchCh, setSearchCh] = useState("");
  const [searchR, setSearchR] = useState("");

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    (async () => {
      // cargar cada colección filtrada por denegado
      const [cqSnap, chSnap, rSnap] = await Promise.all([
        getDocs(query(collection(db, "cuestionarios_cliente"), where("estadoPresupuesto", "==", "DENEGADO"))),
        getDocs(query(collection(db, "checklists"), where("estadoPresupuesto", "==", "DENEGADO"))),
        getDocs(query(collection(db, "recambios"), where("estadoPresupuesto", "==", "DENEGADO"))),
      ]);
      setCuestionarios(cqSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setChecklists(chSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecambios(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, [router]);

  const confirmAndDeleteAll = async (itemId) => {
    // pide clave
    const clave = prompt("Introduce la clave de confirmación para borrar:");
    if (clave !== CONFIRM_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }
    // Borrar chat asociado (si existe)
    await deleteChatTrabajo(db, itemId);

    // confirmaciones encadenadas
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

  async function handleReopenPresupuesto(checklistId) {
  const clave = prompt("Introduce la clave para reabrir el presupuesto:");
  if (clave !== REOPEN_KEY) {
    alert("Clave incorrecta. Operación cancelada.");
    return;
  }
  try {
    // 1) volver a marcar pendiente en las tres colecciones
    await updateDoc(doc(db, "cuestionarios_cliente", checklistId), {
      estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
    });
    await updateDoc(doc(db, "checklists", checklistId), {
      estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
    });
    // si no hay recambios da error, lo ignoramos
    try {
      await updateDoc(doc(db, "recambios", checklistId), {
        estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
      });
    } catch {}

    // 2) actualizar el estado local para que desaparezca de “denegados”
    setCuestionarios((prev) => prev.filter((c) => c.id !== checklistId));
    setChecklists((prev) => prev.filter((c) => c.id !== checklistId));
    setRecambios((prev) => prev.filter((c) => c.id !== checklistId));

    alert("Presupuesto reabierto correctamente.");
  } catch (err) {
    console.error(err);
    alert("Error al reabrir: " + err.message);
  }
}

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Presupuestos Denegados</h1>
      <button
        onClick={() => router.push("/dashboard")}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        ← Volver al Dashboard
      </button>

      {/* Cuestionarios Cliente */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Cuestionarios Cliente</h2>
        {/* búsqueda */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchCq}
            onChange={e => setSearchCq(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        {cuestionarios.filter(c =>
          c.id.toLowerCase().includes(searchCq.toLowerCase())
        ).length === 0 ? (
          <p className="text-gray-600">No hay cuestionarios denegados.</p>
        ) : (
          cuestionarios
            .filter(c => c.id.toLowerCase().includes(searchCq.toLowerCase()))
            .map(c => {
              const [mat, or] = c.id.split("-");
              return (
                <div
                  key={c.id}
                  className="flex justify-between items-center bg-red-100 p-4 mb-2 rounded"
                >
                  <p className="font-medium">{mat} — {or}</p>
                  <div className="space-x-2">
                    <button
                      onClick={() => router.push(`/chat-trabajo/${c.id}?canal=general`)}
                      className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                    >Chat</button>
                    <button
                      onClick={() => router.push(`/cliente-form/${c.id}?view=true`)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >Ver</button>

                        <button
                        onClick={() => handleReopenPresupuesto(c.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                        Reabrir
                        </button>

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

      {/* Checklists */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Checklists</h2>
        {/* búsqueda */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchCh}
            onChange={e => setSearchCh(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        {checklists.filter(c =>
          c.id.toLowerCase().includes(searchCh.toLowerCase())
        ).length === 0 ? (
          <p className="text-gray-600">No hay checklists denegadas.</p>
        ) : (
          checklists
            .filter(c => c.id.toLowerCase().includes(searchCh.toLowerCase()))
            .map(c => {
              const [mat, or] = c.id.split("-");
              return (
                <div
                  key={c.id}
                  className="flex justify-between items-center bg-red-100 p-4 mb-2 rounded"
                >
                  <p className="font-medium">{mat} — {or}</p>
                  <div className="space-x-2">
                    <button
                      onClick={() => router.push(`/chat-trabajo/${c.id}?canal=diagnostico`)}
                      className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                    >Chat</button>
                    <button
                      onClick={() => router.push(`/diagnostico-form/${c.id}/detalle`)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >Ver</button>

                        <button
                        onClick={() => handleReopenPresupuesto(c.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                        Reabrir

                        </button>
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

      {/* Recambios */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Recambios</h2>
        {/* búsqueda */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchR}
            onChange={e => setSearchR(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        {recambios.filter(c =>
          c.id.toLowerCase().includes(searchR.toLowerCase())
        ).length === 0 ? (
          <p className="text-gray-600">No hay recambios denegados.</p>
        ) : (
          recambios
            .filter(c => c.id.toLowerCase().includes(searchR.toLowerCase()))
            .map(c => {
              const [mat, or] = c.id.split("-");
              return (
                <div
                  key={c.id}
                  className="flex justify-between items-center bg-red-100 p-4 mb-2 rounded"
                >
                  <p className="font-medium">{mat} — {or}</p>
                  <div className="space-x-2">
                    <button
                      onClick={() => router.push(`/chat-trabajo/${c.id}?canal=recambios`)}
                      className="px-3 py-1 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                    >Chat</button>
                    <button
                      onClick={() => router.push(`/recambios-form/${c.id}/detalle`)}
                      className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >Ver</button>

                        <button
                        onClick={() => handleReopenPresupuesto(c.id)}
                        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                        >
                        Reabrir
                        </button>

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
