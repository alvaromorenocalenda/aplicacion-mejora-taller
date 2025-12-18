// app/diagnostico-form/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  deleteDoc,
  updateDoc,
  doc
} from "firebase/firestore";

import { deleteChatTrabajo } from "../../lib/chatCleanup";

// clave para confirmar borrado
const CONFIRM_KEY = "CALENDABORRAR";
const CONFIRM_REJECT_KEY  = "CALENDADENEGAR";  // para denegar presupuesto
const CONFIRM_FINALIZAR_KEY = "CALENDAFINALIZAR";

export default function DiagnosticosPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [realizadas, setRealizadas] = useState([]);

  // estados de búsqueda
  const [searchPend, setSearchPend] = useState("");
  const [searchReal, setSearchReal] = useState("");

  // Protege ruta
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/login");
    } else {
      setUser(u);
      setLoading(false);
    }
  }, [router]);

  // Carga cuestionarios y checklists filtrando por presupuesto pendiente
  useEffect(() => {
    if (!user) return;
    (async () => {
      // 1) Cargar cuestionarios cliente PENDIENTE_PRESUPUESTO
      const q1 = query(
        collection(db, "cuestionarios_cliente"),
        where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"),
        orderBy("creadoEn", "desc")
      );
      const snap1 = await getDocs(q1);
      const all = snap1.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 2) Separa pendientes vs realizadas
      const qc = collection(db, "checklists");
      const pend = [];
      const real = [];

      for (const c of all) {
        // consulta checklists vinculadas PENDIENTE_PRESUPUESTO
        const q2 = query(
          qc,
          where("cuestionarioId", "==", c.id),
          where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO")
        );
        const snap2 = await getDocs(q2);

        if (snap2.empty) {
          pend.push(c);
        } else {
          const chk = snap2.docs[0];
          real.push({
            ...c,
            completadoEn: chk.data().completadoEn,
            checklistId: chk.id,
          });
        }
      }

      setPendientes(pend);
      // orden descendente por fecha completado
      real.sort(
        (a, b) => b.completadoEn.toMillis() - a.completadoEn.toMillis()
      );
      setRealizadas(real);
    })();
  }, [user]);

  if (loading) {
    return <p className="p-6 text-center">Comprobando sesión…</p>;
  }

  /**
   * Borrar checklist y opcionalmente el cuestionario cliente asociado.
   * @param {string} checklistId
   * @param {string} cuestionarioId
   */
  const handleDelete = async (checklistId, cuestionarioId) => {
    const clave = prompt("Introduce la clave de confirmación para borrar:");
    if (clave !== CONFIRM_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }

    try {
      // Borrar chat asociado al trabajo
      await deleteChatTrabajo(db, cuestionarioId);
      if (confirm("¿Deseas borrar los recambios asociados?")) {
        await deleteDoc(doc(db, "checklists", checklistId));
        setRealizadas((prev) =>
          prev.filter((c) => c.checklistId !== checklistId)
        );
        alert("Recambios eliminados.");
      }
      if (
        confirm(
          "¿Deseas también borrar el cuestionario cliente asociado?"
        )
      ) {
        await deleteDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
        setPendientes((prev) => prev.filter((c) => c.id !== cuestionarioId));
        alert("Cuestionario cliente eliminado.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al borrar: " + err.message);
    }
  };

 // rechazar presupuesto con clave y dos params
  const handleRejectPresupuesto = async (checklistId, cuestionarioId) => {
    const clave = prompt("Para denegar presupuesto introduce la clave:");
    if (clave !== CONFIRM_REJECT_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }
    try {
      // Si se deniega, también borramos el chat asociado
      await deleteChatTrabajo(db, cuestionarioId);
      await updateDoc(doc(db, "cuestionarios_cliente", cuestionarioId), { estadoPresupuesto: "DENEGADO" });
      await updateDoc(doc(db, "checklists", checklistId), {           estadoPresupuesto: "DENEGADO" });
      try {
        await updateDoc(doc(db, "recambios", checklistId), {      estadoPresupuesto: "DENEGADO" });
      } catch {}
      // refrescar lista: retirar
      setRealizadas(prev => prev.filter(c => c.checklistId !== checklistId));
      setPendientes(prev => prev.filter(c => c.id !== cuestionarioId));
    } catch(err) {
      console.error(err);
      alert("Error al denegar: " + err.message);
    }
  };

  const handleFinalizarPresupuesto = async (checklistId, cuestionarioId) => {
  const clave = prompt("Para finalizar el trabajo, introduce la clave:");
  if (clave !== CONFIRM_FINALIZAR_KEY) {
    alert("Clave incorrecta. Operación cancelada.");
    return;
  }
  try {
    // Si se finaliza, también borramos el chat asociado
    await deleteChatTrabajo(db, cuestionarioId);
    await updateDoc(doc(db, "cuestionarios_cliente", cuestionarioId), { estadoPresupuesto: "FINALIZADO" });
    await updateDoc(doc(db, "checklists", checklistId), { estadoPresupuesto: "FINALIZADO" });
    try {
      await updateDoc(doc(db, "recambios", checklistId), { estadoPresupuesto: "FINALIZADO" });
    } catch {}
    // Refrescar listas
    setRealizadas(prev => prev.filter(c => c.checklistId !== checklistId));
    setPendientes(prev => prev.filter(c => c.id !== cuestionarioId));
    alert("Trabajo finalizado correctamente.");
  } catch (err) {
    console.error(err);
    alert("Error al finalizar: " + err.message);
  }
};

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Diagnósticos</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Volver al Dashboard
          </button>
          <button
            onClick={() =>
              auth.signOut().then(() => router.replace("/login"))
            }
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Pendientes */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">
          Pendientes de diagnóstico
        </h2>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchPend}
            onChange={(e) => setSearchPend(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {pendientes.length === 0 ? (
          <p className="text-gray-600">No hay pendientes.</p>
        ) : (
          pendientes
            .filter(
              (c) =>
                c.datos.matricula.toLowerCase().includes(searchPend.toLowerCase()) ||
                c.datos.numeroOR.toLowerCase().includes(searchPend.toLowerCase())
            )
            .map((c) => (
              <div
                key={c.id}
                className="flex justify-between items-center bg-white p-4 mb-2 rounded shadow"
              >
                <div>
                  <p className="font-medium">
                    {c.datos.matricula} — {c.datos.numeroOR}
                  </p>
                  <p className="text-sm text-gray-500">
                    Creado: {c.creadoEn.toDate().toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/chat-trabajo/${c.id}?canal=diagnostico`)}
                    className="px-4 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => router.push(`/diagnostico-form/${c.id}`)}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Diagnosticar
                  </button>
                </div>
              </div>
            ))
        )}
      </section>

      {/* Realizadas */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Checklist realizadas</h2>

        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchReal}
            onChange={(e) => setSearchReal(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {realizadas.length === 0 ? (
          <p className="text-gray-600">No hay checklist realizadas.</p>
        ) : (
          realizadas
            .filter(
              (c) =>
                c.datos.matricula.toLowerCase().includes(searchReal.toLowerCase()) ||
                c.datos.numeroOR.toLowerCase().includes(searchReal.toLowerCase())
            )
            .map((c) => (
              <div
                key={c.checklistId}
                className="flex justify-between items-center bg-green-100 p-4 mb-2 rounded"
              >
                <div>
                  <p className="font-medium">
                    {c.datos.matricula} — {c.datos.numeroOR}
                  </p>
                  <p className="text-sm text-gray-500">
                    Completado: {c.completadoEn.toDate().toLocaleString()}
                  </p>
                </div>
                <div className="space-x-2">
                <button
                  onClick={() => router.push(`/chat-trabajo/${c.id}?canal=diagnostico`)}
                  className="px-4 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
                >
                  Chat
                </button>
                <button
                  onClick={() => router.push(`/diagnostico-form/${c.checklistId}/detalle`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Ver
                </button>
                <button
                  onClick={() => router.push(`/diagnostico-form/${c.id}`)}
                  className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleRejectPresupuesto(c.checklistId, c.id)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Rechazar presupuesto
                </button>
                <button
                  onClick={() => handleFinalizarPresupuesto(c.checklistId, c.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Finalizar
                </button>
                <button
                  onClick={() => handleDelete(c.checklistId, c.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Borrar
                </button>
              </div>

              </div>
            ))
        )}
      </section>
    </main>
  );
}
