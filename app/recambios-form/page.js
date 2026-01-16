// app/recambios-form/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

import { deleteChatTrabajo } from "../../lib/chatCleanup";
import { subscribeUserProfile } from "../../lib/userProfile";

const CONFIRM_KEY = "CALENDABORRAR"; // sigue para borrado
const CONFIRM_REJECT_KEY = "CALENDADENEGAR"; // para denegar presupuesto
const CONFIRM_FINALIZAR_KEY = "CALENDAFINALIZAR";

export default function RecambiosListPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [userRol, setUserRol] = useState("ADMIN");

  // ✅ Mapa trabajoId -> tiene mensajes no leídos
  const [unreadMap, setUnreadMap] = useState({});

  // ✅ Solo se inicializa una vez según rol (para no pisarte al hacer click)
  const didInitOnlyMine = useRef(false);
  const [onlyMine, setOnlyMine] = useState(true);

  // ✅ Guardamos listas completas (sin filtrar por mecánico)
  const [pendientesAll, setPendientesAll] = useState([]);
  const [realizadosAll, setRealizadosAll] = useState([]);

  const [searchPend, setSearchPend] = useState("");
  const [searchReal, setSearchReal] = useState("");

  // Evitar respuestas viejas pisando estado
  const loadSeq = useRef(0);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
  }, [router]);

  // ✅ Rol de usuario: NO depende de onlyMine, y NO debe forzarlo continuamente
  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => {
      const rol = (p?.rol || "ADMIN").toUpperCase();
      setUserRol(rol);

      // ✅ poner por defecto SOLO una vez
      if (!didInitOnlyMine.current) {
        didInitOnlyMine.current = true;
        setOnlyMine(rol === "MECANICO");
      }
    });
  }, [user]);

  // Helper: Firestore "in" tiene límite (30)
  async function fetchCuestionariosByIds(ids) {
    const out = new Map();
    const CHUNK = 30;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      // donde "__name__" es el id del doc
      const snap = await getDocs(
        query(collection(db, "cuestionarios_cliente"), where("__name__", "in", chunk))
      );
      snap.docs.forEach((d) => out.set(d.id, d.data()));
    }

    return out;
  }

  // ✅ Cargar datos SOLO cuando hay usuario (NO depende de onlyMine)
  useEffect(() => {
    if (!user) return;

    const mySeq = ++loadSeq.current;

    (async () => {
      // 1) Checklists con presupuesto pendiente (base de recambios)
      const chkSnap = await getDocs(
        query(
          collection(db, "checklists"),
          where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"),
          orderBy("completadoEn", "desc")
        )
      );

      if (mySeq !== loadSeq.current) return;

      const checks = chkSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // 2) Recambios pendientes (para saber estadoRecambios y checklistEditada)
      const recSnap = await getDocs(
        query(collection(db, "recambios"), where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"))
      );

      if (mySeq !== loadSeq.current) return;

      const recById = new Map(recSnap.docs.map((d) => [d.id, d.data()]));

      // 3) 🔥 Traer asignación desde cuestionarios_cliente usando cuestionarioId de cada checklist
      const idsCuestionarios = Array.from(
        new Set(checks.map((c) => c.cuestionarioId).filter(Boolean))
      );

      let cuestionariosMap = new Map();
      if (idsCuestionarios.length > 0) {
        cuestionariosMap = await fetchCuestionariosByIds(idsCuestionarios);
      }

      if (mySeq !== loadSeq.current) return;

      // 4) Construir listas "pendientes/realizados" (ALL) enriquecidas con asignación
      const pend = [];
      const real = [];

      for (const c of checks) {
        const rec = recById.get(c.id);
        const estado = rec?.estadoRecambios || "SIN_INICIAR";

        const cuest = c.cuestionarioId ? cuestionariosMap.get(c.cuestionarioId) : null;

        const item = {
          ...c,

          // ✅ asignación: primero la que venga ya en checklist, si no, la del cuestionario
          asignadoMecanicoUid: c.asignadoMecanicoUid ?? cuest?.asignadoMecanicoUid ?? null,
          asignadoMecanicoNombre: c.asignadoMecanicoNombre ?? cuest?.asignadoMecanicoNombre ?? null,

          // estado recambios y avisos
          estadoRecambios: estado,
          checklistEditada: !!rec?.checklistEditada,
        };

        if (rec && estado === "FINALIZADO") real.push(item);
        else pend.push(item);
      }

      setPendientesAll(pend);
      setRealizadosAll(real);
    })();
  }, [user]);

  // ✅ Detectar chats con mensajes no leídos (badge "NUEVO")
  useEffect(() => {
    if (!user) return;

    let alive = true;

    (async () => {
      const uid = user.uid;

      const ids = Array.from(
        new Set(
          [
            ...(pendientesAll || []).map((c) => String(c.cuestionarioId || c.id)),
            ...(realizadosAll || []).map((c) => String(c.cuestionarioId || c.id)),
          ].filter(Boolean)
        )
      );

      const results = await Promise.all(
        ids.map(async (trabajoId) => {
          try {
            const chatSnap = await getDoc(doc(db, "chats_trabajos", trabajoId));
            if (!chatSnap.exists()) return [trabajoId, false];

            const chat = chatSnap.data() || {};
            const updatedMs =
              chat.updatedAt?.toMillis?.() ||
              (chat.updatedAt?.seconds ? chat.updatedAt.seconds * 1000 : 0) ||
              0;

            const readSnap = await getDoc(
              doc(db, "chats_trabajos", trabajoId, "reads", uid)
            );
            const lastReadMs = readSnap.exists()
              ? readSnap.data()?.lastReadAt?.toMillis?.() || 0
              : 0;

            const unread =
              updatedMs > lastReadMs &&
              chat.lastSenderUid &&
              chat.lastSenderUid !== uid;

            return [trabajoId, !!unread];
          } catch {
            return [trabajoId, false];
          }
        })
      );

      if (!alive) return;
      const map = {};
      results.forEach(([id, v]) => (map[id] = v));
      setUnreadMap(map);
    })();

    return () => {
      alive = false;
    };
  }, [pendientesAll, realizadosAll, user]);

  // ✅ Filtrar EN MEMORIA (a prueba de clicks rápidos)
  const pendientes = useMemo(() => {
    if (!user) return [];
    if (userRol === "MECANICO" && onlyMine) {
      return pendientesAll.filter((c) => c.asignadoMecanicoUid === user.uid);
    }
    return pendientesAll;
  }, [pendientesAll, userRol, onlyMine, user]);

  const realizados = useMemo(() => {
    if (!user) return [];
    if (userRol === "MECANICO" && onlyMine) {
      return realizadosAll.filter((c) => c.asignadoMecanicoUid === user.uid);
    }
    return realizadosAll;
  }, [realizadosAll, userRol, onlyMine, user]);

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

  const match = (c, term) => {
    const t = (term || "").toLowerCase();
    return (
      (c?.datos?.matricula || "").toLowerCase().includes(t) ||
      (c?.datos?.numeroOR || "").toLowerCase().includes(t) ||
      (c?.datos?.nombreCliente || "").toLowerCase().includes(t)
    );
  };

  // Borrar checklist y cuestionario
  const handleDelete = async (checklistId, datos) => {
    const clave = prompt("Introduce la clave de confirmación para borrar:");
    if (clave !== CONFIRM_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }

    try {
      // Borrar chat asociado al trabajo (si existe)
      const trabajoId = String(datos?.cuestionarioId || checklistId);
      await deleteChatTrabajo(db, trabajoId);

      // 1. Borrar recambio
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
      const borrarCuestionario = confirm(
        "¿Deseas también borrar el cuestionario cliente asociado?"
      );
      if (borrarCuestionario) {
        try {
          await deleteDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
          alert("Cuestionario cliente eliminado.");
        } catch (err) {
          console.warn("No se encontró el cuestionario:", err.message);
        }
      }

      // 4. Actualizar interfaz (en ALL)
      setRealizadosAll((prev) => prev.filter((c) => c.id !== checklistId));
      setPendientesAll((prev) => prev.filter((c) => c.id !== checklistId));
    } catch (err) {
      console.error("Error al borrar:", err);
      alert("Error al borrar: " + err.message);
    }
  };

  // Rechazar presupuesto (marca DENEGADO)
  const handleRejectPresupuesto = async (checklistId) => {
    const clave = prompt("Para denegar presupuesto introduce la clave:");
    if (clave !== CONFIRM_REJECT_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }
    try {
      await deleteChatTrabajo(db, checklistId);

      await updateDoc(doc(db, "checklists", checklistId), {
        estadoPresupuesto: "DENEGADO",
      });

      try {
        await updateDoc(doc(db, "recambios", checklistId), {
          estadoPresupuesto: "DENEGADO",
        });
      } catch {}

      await updateDoc(doc(db, "cuestionarios_cliente", checklistId), {
        estadoPresupuesto: "DENEGADO",
      });

      alert("Presupuesto marcado como DENEGADO.");
      setRealizadosAll((prev) => prev.filter((c) => c.id !== checklistId));
      setPendientesAll((prev) => prev.filter((c) => c.id !== checklistId));
    } catch (err) {
      console.error(err);
      alert("Error al rechazar presupuesto: " + err.message);
    }
  };

  const handleFinalizarPresupuesto = async (checklistId) => {
    const clave = prompt("Para finalizar este trabajo, introduce la clave:");
    if (clave !== CONFIRM_FINALIZAR_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }

    try {
      await deleteChatTrabajo(db, checklistId);

      await updateDoc(doc(db, "checklists", checklistId), {
        estadoPresupuesto: "FINALIZADO",
      });

      try {
        await updateDoc(doc(db, "recambios", checklistId), {
          estadoPresupuesto: "FINALIZADO",
        });
      } catch {}

      await updateDoc(doc(db, "cuestionarios_cliente", checklistId), {
        estadoPresupuesto: "FINALIZADO",
      });

      alert("Presupuesto marcado como FINALIZADO.");
      setRealizadosAll((prev) => prev.filter((c) => c.id !== checklistId));
      setPendientesAll((prev) => prev.filter((c) => c.id !== checklistId));
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

      {userRol === "MECANICO" && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <input
            id="onlyMineRec"
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
          />
          <label htmlFor="onlyMineRec">Ver sólo mis trabajos asignados</label>
        </div>
      )}

      {/* Pendientes de recambios */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Pendientes de recambios</h2>
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula, número de orden o nombre..."
            value={searchPend}
            onChange={(e) => setSearchPend(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {pendientes.filter((c) => match(c, searchPend)).map((c) => (
          <div
            key={c.id}
            className={`flex items-center p-4 mb-2 rounded ${
              c.checklistEditada ? "bg-yellow-100 border border-yellow-400" : "bg-green-100"
            }`}
          >
            <div className="flex-grow">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-medium flex items-center flex-wrap gap-2">
                  <span>
                    {c?.datos?.matricula} — {c?.datos?.numeroOR} — {c?.datos?.nombreCliente || ""}
                  </span>
                  {unreadMap?.[String(c.cuestionarioId || c.id)] ? (
                    <span className="inline-flex items-center gap-2 px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white">
                      ● NUEVO MENSAJE
                    </span>
                  ) : null}
                </p>
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${estadoBadgeClass(
                    c.estadoRecambios
                  )}`}
                >
                  {estadoLabel(c.estadoRecambios)}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                <div>Completado: {c.completadoEn?.toDate?.().toLocaleString?.() || ""}</div>
                {c.checklistEditada && (
                  <div className="text-sm text-yellow-800 font-semibold mt-1">
                    ⚠️ Checklist modificada tras añadir recambios
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/chat-trabajo/${c.cuestionarioId || c.id}`)}
                className="px-4 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
              >
                Chat
              </button>
              <button
                onClick={() => router.push(`/recambios-form/${c.id}`)}
                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
              >
                Añadir recambios
              </button>
            </div>
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
            placeholder="🔍 Buscar matrícula, número de orden o nombre..."
            value={searchReal}
            onChange={(e) => setSearchReal(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {realizados.filter((c) => match(c, searchReal)).map((c) => (
          <div key={c.id} className="flex items-center bg-green-100 p-4 mb-2 rounded">
            <div className="flex-grow">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-medium flex items-center flex-wrap gap-2">
                  <span>
                    {c?.datos?.matricula} — {c?.datos?.numeroOR} — {c?.datos?.nombreCliente || ""}
                  </span>
                  {unreadMap?.[String(c.cuestionarioId || c.id)] ? (
                    <span className="inline-flex items-center gap-2 px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white">
                      ● NUEVO
                    </span>
                  ) : null}
                </p>
                <span
                  className={`px-3 py-1 rounded text-xs font-semibold ${estadoBadgeClass(
                    c.estadoRecambios
                  )}`}
                >
                  {estadoLabel(c.estadoRecambios)}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Completado: {c.completadoEn?.toDate?.().toLocaleString?.() || ""}
              </p>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => router.push(`/chat-trabajo/${c.cuestionarioId || c.id}`)}
                className="px-4 py-2 bg-fuchsia-600 text-white rounded hover:bg-fuchsia-700"
              >
                Chat
              </button>
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
