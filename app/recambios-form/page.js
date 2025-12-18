// app/recambios-form/page.js
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
  doc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";

const CONFIRM_KEY         = "CALENDABORRAR";   // sigue para borrado
const CONFIRM_REJECT_KEY  = "CALENDADENEGAR";  // para denegar presupuesto
const CONFIRM_FINALIZAR_KEY = "CALENDAFINALIZAR";


export default function RecambiosListPage() {
  const router = useRouter();
  const [pendientes, setPendientes] = useState([]);
  const [realizados, setRealizados] = useState([]);
  const [searchPend, setSearchPend] = useState("");
  const [searchReal, setSearchReal] = useState("");

  useEffect(() => {
    if (!auth.currentUser) router.replace("/login");
  }, [router]);

  useEffect(() => {
    (async () => {
      // Traer solo checklists con presupuesto pendiente
      const chkSnap = await getDocs(
        query(
          collection(db, "checklists"),
          where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"),
          orderBy("completadoEn", "desc")
        )
      );
      const checks = chkSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Traer solo recambios con presupuesto pendiente (incluyendo estadoRecambios)
      const recSnap = await getDocs(
        query(
          collection(db, "recambios"),
          where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO")
        )
      );
      const recById = new Map(recSnap.docs.map(d => [d.id, d.data()]));

      const pend = [];
      const real = [];
      for (const c of checks) {
        const rec = recById.get(c.id);
        const estado = rec?.estadoRecambios || "SIN_INICIAR";
        const item = { ...c, estadoRecambios: estado };
        if (rec && estado === "FINALIZADO") real.push(item);
        else pend.push(item);
      }

      setPendientes(pend);
      setRealizados(real);
    })();
  }, []);

  const estadoLabel = (estado) => {
    switch (estado) {
      case "EN_PROCESO":
        return "En proceso";
      case "FINALIZADO":
        return "Finalizado";
      default:
        return "Sin iniciar";
    }
  };

  const estadoBadgeClass = (estado) => {
    switch (estado) {
      case "EN_PROCESO":
        return "bg-yellow-300 text-yellow-900";
      case "FINALIZADO":
        return "bg-green-400 text-green-900";
      default:
        return "bg-gray-300 text-gray-800";
    }
  };

  // Borrar checklist y cuestionario
const handleDelete = async (checklistId, datos) => {
  const clave = prompt("Introduce la clave de confirmación para borrar:");
  if (clave !== CONFIRM_KEY) {
    alert("Clave incorrecta. Operación cancelada.");
    return;
  }

  try {
    // 1. Borrar directamente el recambio (ya que es lo que se está eliminando)
    console.log("Eliminando recambio:", checklistId); // DEBUG
    await deleteDoc(doc(db, "recambios", checklistId));
    alert("Recambios eliminados correctamente.");

    // 2. Preguntar si también quiere borrar la checklist
    const borrarChecklist = confirm("¿Deseas borrar la checklist asociada?");
    if (borrarChecklist) {
      try {
        await deleteDoc(doc(db, "checklists", checklistId));
        alert("Checklist eliminada.");
      } catch (err) {
        console.warn("No se encontró la checklist:", err.message);
      }
    }

    // 3. Preguntar si también quiere borrar el cuestionario cliente
    const cuestionarioId = `${datos.matricula}-${datos.numeroOR}`;
    const borrarCuestionario = confirm("¿Deseas también borrar el cuestionario cliente asociado?");
    if (borrarCuestionario) {
      try {
        await deleteDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
        alert("Cuestionario cliente eliminado.");
      } catch (err) {
        console.warn("No se encontró el cuestionario:", err.message);
      }
    }

    // 4. Actualizar la interfaz
    setRealizados(prev => prev.filter(c => c.id !== checklistId));
  } catch (err) {
    console.error("Error al borrar:", err);
    alert("Error al borrar: " + err.message);
  }
};


  // Rechazar presupuesto (marca DENEGADO)
 const handleRejectPresupuesto = async (checklistId) => {
   // 1) pedimos clave específica para denegar presupuesto
   const clave = prompt("Para denegar presupuesto introduce la clave:");
   if (clave !== CONFIRM_REJECT_KEY) {
     alert("Clave incorrecta. Operación cancelada.");
     return;
   }
    try {
      await updateDoc(doc(db, "checklists", checklistId), {
        estadoPresupuesto: "DENEGADO"
      });
      // 3) Marcamos recambios como DENEGADO (si existen)
      try {
      await updateDoc(doc(db, "recambios", checklistId), {
        estadoPresupuesto: "DENEGADO",
      });
      } catch (e) {
      // no existe recambios, ignorar
      }
      await updateDoc(doc(db, "cuestionarios_cliente", checklistId), {
        estadoPresupuesto: "DENEGADO"
      });
      await updateDoc(doc(db, "recambios", checklistId), {
        estadoPresupuesto: "DENEGADO"
      });
      alert("Presupuesto marcado como DENEGADO.");
      setRealizados(prev => prev.filter(c => c.id !== checklistId));
    } catch (err) {
      console.error(err);
      alert("Error al rechazar presupuesto: " + err.message);
    }
  };

  const match = (c, term) => {
    const t = term.toLowerCase();
    return (
      c.datos.matricula.toLowerCase().includes(t) ||
      c.datos.numeroOR.toLowerCase().includes(t)
    );
  };

const handleFinalizarPresupuesto = async (checklistId) => {
  const clave = prompt("Para finalizar este trabajo, introduce la clave:");
  if (clave !== CONFIRM_FINALIZAR_KEY) {
    alert("Clave incorrecta. Operación cancelada.");
    return;
  }

  try {
    // Marcar como FINALIZADO en todas las colecciones asociadas
    await updateDoc(doc(db, "checklists", checklistId), {
      estadoPresupuesto: "FINALIZADO",
    });

    try {
      await updateDoc(doc(db, "recambios", checklistId), {
        estadoPresupuesto: "FINALIZADO",
      });
    } catch (e) {
      // recambios puede no existir; se ignora
    }

    await updateDoc(doc(db, "cuestionarios_cliente", checklistId), {
      estadoPresupuesto: "FINALIZADO",
    });

    alert("Presupuesto marcado como FINALIZADO.");
    setRealizados(prev => prev.filter(c => c.id !== checklistId));
  } catch (err) {
    console.error(err);
    alert("Error al finalizar: " + err.message);
  }
};


  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Recambios</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Volver al Dashboard
          </button>
          <button
            onClick={() => auth.signOut().then(() => router.replace("/login"))}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Pendientes de recambios */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Pendientes de recambios</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchPend}
            onChange={e => setSearchPend(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        {pendientes.filter(c => match(c, searchPend)).map(c => (
          <div
            key={c.id}
            className={`flex items-center p-4 mb-2 rounded ${
              c.checklistEditada ? 'bg-yellow-100 border border-yellow-400' : 'bg-green-100'
            }`}
          >

          <div className="flex-grow">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="font-medium">{c.datos.matricula} — {c.datos.numeroOR}</p>
              <span
                className={`px-3 py-1 rounded text-xs font-semibold ${estadoBadgeClass(c.estadoRecambios)}`}
              >
                {estadoLabel(c.estadoRecambios)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              <div>Completado: {c.completadoEn.toDate().toLocaleString()}</div>
              {c.checklistEditada && (
                <div className="text-sm text-yellow-800 font-semibold mt-1">
                  ⚠️ Checklist modificada tras añadir recambios
                </div>
              )}
            </div>
          </div>
            <button
              onClick={() => router.push(`/recambios-form/${c.id}`)}
              className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
            >
              Añadir recambios
            </button>
          </div>
        ))}
        {pendientes.length === 0 && <p className="text-gray-600">No hay pendientes.</p>}
      </section>

      {/* Recambios realizados */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Recambios realizados</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula o número de orden..."
            value={searchReal}
            onChange={e => setSearchReal(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>
        {realizados.filter(c => match(c, searchReal)).map(c => (
          <div
            key={c.id}
            className="flex items-center bg-green-100 p-4 mb-2 rounded"
          >
            <div className="flex-grow">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-medium">{c.datos.matricula} — {c.datos.numeroOR}</p>
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${estadoBadgeClass(c.estadoRecambios)}`}
                >
                  {estadoLabel(c.estadoRecambios)}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Completado: {c.completadoEn.toDate().toLocaleString()}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => router.push(`/recambios-form/${c.id}/detalle`)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver
              </button>
              <button
                onClick={() => router.push(`/recambios-form/${c.id}`)}
                className="px-4 py-2 bg-pink-400 text-white rounded hover:bg-pink-500"
              >
                Editar
              </button>
              <button
                onClick={() => handleRejectPresupuesto(c.id)}
                className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                Rechazar presupuesto
              </button>
              <button
                onClick={() => handleFinalizarPresupuesto(c.id)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Finalizar
              </button>
              <button
                onClick={() => handleDelete(c.id, c.datos)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>

          </div>
        ))}
        {realizados.length === 0 && <p className="text-gray-600">No hay recambios realizados.</p>}
      </section>
    </main>
  );
}
