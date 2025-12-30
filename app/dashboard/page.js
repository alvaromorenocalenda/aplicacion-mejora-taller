// app/dashboard/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
} from "firebase/firestore";

import { registerPushForUser } from "../../lib/pushNotifications";
import { deleteChatTrabajo } from "../../lib/chatCleanup";
import { subscribeUserProfile } from "../../lib/userProfile";

// Clave para confirmar borrado
const CONFIRM_KEY = "CALENDABORRAR";
const CONFIRM_DENY_KEY = "CALENDADENEGAR";
const CONFIRM_FINISH_KEY = "CALENDAFINALIZAR";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Mapa trabajoId -> tiene mensajes no leídos
  const [unreadMap, setUnreadMap] = useState({});

  const [userRol, setUserRol] = useState("ADMIN");
  const [onlyMine, setOnlyMine] = useState(true);

  // ✅ Estado para UI de notificaciones
  const [pushStatus, setPushStatus] = useState("idle"); // idle | working | enabled | error

  // ✅ FUNCIÓN: activar push y guardar token (esto crea users/{uid}/fcmTokens/{token})
  const handleEnableNotifications = async () => {
    try {
      if (!auth.currentUser) {
        alert("No hay usuario logueado.");
        return;
      }

      setPushStatus("working");

      const uid = auth.currentUser.uid;

      const token = await registerPushForUser(
        uid,
        { email: auth.currentUser.email || "" },
        { requestPermission: true }
      );

      if (!token) {
        setPushStatus("idle");
        alert("No se pudo activar push (permiso denegado o sin VAPID key).");
        return;
      }

      setPushStatus("enabled");
      alert("✅ Notificaciones activadas.");
    } catch (err) {
      console.error("Error activando notificaciones:", err);
      setPushStatus("error");
      alert("Error activando notificaciones: " + (err?.message || err));
    }
  };

  // 1) Comprobar sesión
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, [router]);

  // Rol de usuario (para limitar trabajos a un mecánico)
  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => {
      const rol = (p?.rol || "ADMIN").toUpperCase();
      setUserRol(rol);
      if (rol !== "MECANICO") setOnlyMine(false);
      else setOnlyMine(true);
    });
  }, [user]);

  // ✅ Auto-registrar token si ya hay permiso concedido
  useEffect(() => {
    if (!user) return;

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      registerPushForUser(
        user.uid,
        { email: user.email || "" },
        { requestPermission: false }
      )
        .then((token) => {
          if (token) setPushStatus("enabled");
        })
        .catch((e) => {
          console.warn("Auto-register push falló:", e);
        });
    }
  }, [user]);

  // ✅ Detectar chats con mensajes no leídos (badge "NUEVO")
  useEffect(() => {
    if (!user) return;

    let alive = true;

    (async () => {
      const uid = user.uid;

      const results = await Promise.all(
        (items || []).map(async (it) => {
          const trabajoId = String(it.id);
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
  }, [items, user]);

  // 2) Suscribirse sólo a los cuestionarios con presupuesto PENDIENTE
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "cuestionarios_cliente"),
      where("estadoPresupuesto", "==", "PENDIENTE_PRESUPUESTO"),
      orderBy("creadoEn", "desc")
    );
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        datos: d.data().datos,
        creadoEn: d.data().creadoEn,
        asignadoMecanicoUid: d.data().asignadoMecanicoUid || null,
        asignadoMecanicoNombre: d.data().asignadoMecanicoNombre || null,
      }));

      // Si el usuario es MECANICO, por defecto ver sólo sus trabajos
      if (userRol === "MECANICO" && onlyMine) {
        setItems(list.filter((it) => it.asignadoMecanicoUid === user.uid));
      } else {
        setItems(list);
      }
    });
  }, [user, userRol, onlyMine]);

  // 3) Eliminar cuestionario con clave
  const handleDelete = async (id) => {
    const clave = prompt(
      "Para borrar este cuestionario, introduce la clave de confirmación:"
    );

    if (clave !== CONFIRM_KEY) {
      alert("Clave incorrecta. No se ha borrado nada.");
      return;
    }

    if (!confirm("¿Estás seguro de que quieres eliminar este cuestionario?")) {
      return;
    }

    // Paso 1: preguntar por checklist
    const borrarChecklist = confirm(
      "¿Quieres eliminar también la checklist asociada (si existe)?"
    );

    // Paso 2: preguntar por recambios
    const borrarRecambios = confirm(
      "¿Quieres eliminar también los recambios asociados (si existe)?"
    );

    try {
      // Borrar chat asociado (si existe)
      await deleteChatTrabajo(db, id);

      // 1. Eliminar checklist si aplica
      if (borrarChecklist) {
        try {
          await deleteDoc(doc(db, "checklists", id));
        } catch (err) {
          console.warn("No se encontró checklist:", err.message);
        }
      }

      // 2. Eliminar recambios si aplica
      if (borrarRecambios) {
        try {
          await deleteDoc(doc(db, "recambios", id));
        } catch (err) {
          console.warn("No se encontró recambios:", err.message);
        }
      }

      // 3. Eliminar cuestionario principal
      await deleteDoc(doc(db, "cuestionarios_cliente", id));

      alert("Cuestionario y elementos asociados eliminados correctamente.");
    } catch (err) {
      console.error("Error al eliminar:", err);
      alert("Ocurrió un error al eliminar.");
    }
  };

  // Marca como DENEGADO el presupuesto y lo quita de la lista.
  const handleRejectPresupuesto = async (id) => {
    const clave = prompt("Para denegar presupuesto, introduce la clave:");
    if (clave !== CONFIRM_DENY_KEY) {
      alert("Clave incorrecta. Operación cancelada.");
      return;
    }
    try {
      // Si se deniega, también eliminamos el chat asociado
      await deleteChatTrabajo(db, id);

      // 1) Actualiza sólo el cuestionario
      await updateDoc(doc(db, "cuestionarios_cliente", id), {
        estadoPresupuesto: "DENEGADO",
      });
      // 2) Si tiene checklist pendiente, lo marcamos también:
      await updateDoc(doc(db, "checklists", id), {
        estadoPresupuesto: "DENEGADO",
      });
      // 3) Y recambios si existen:
      try {
        await updateDoc(doc(db, "recambios", id), {
          estadoPresupuesto: "DENEGADO",
        });
      } catch {}
      alert("Presupuesto denegado correctamente.");
      // 4) Refresca el listado quitando el elemento:
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      console.error(err);
      alert("Error al denegar presupuesto: " + err.message);
    }
  };

  const handleFinalizar = async (id) => {
    const clave = prompt("Introduce la clave para finalizar este trabajo:");
    if (clave !== CONFIRM_FINISH_KEY) {
      alert("Clave incorrecta. No se ha finalizado nada.");
      return;
    }
    try {
      // Si se finaliza, también eliminamos el chat asociado
      await deleteChatTrabajo(db, id);

      // 1. Marcar cuestionario como FINALIZADO
      await updateDoc(doc(db, "cuestionarios_cliente", id), {
        estadoPresupuesto: "FINALIZADO",
      });

      // 2. Marcar checklist como FINALIZADO
      await updateDoc(doc(db, "checklists", id), {
        estadoPresupuesto: "FINALIZADO",
      });

      // 3. Marcar recambios como FINALIZADO (si existen)
      try {
        await updateDoc(doc(db, "recambios", id), {
          estadoPresupuesto: "FINALIZADO",
        });
      } catch {}

      // 4. Eliminar del listado actual
      setItems((prev) => prev.filter((item) => item.id !== id));

      alert("Trabajo finalizado correctamente.");
    } catch (err) {
      console.error("Error al finalizar trabajo:", err);
      alert("Error al finalizar el trabajo: " + err.message);
    }
  };

  // 4) Cerrar sesión
  const handleSignOut = async () => {
    await signOut(auth);
    router.replace("/login");
  };

  if (!authChecked)
    return <p className="p-6 text-center">Comprobando sesión…</p>;

  // Filtrar items según el término de búsqueda
  const filteredItems = items.filter(({ datos }) => {
    const hay = [datos.matricula, datos.numeroOR, datos.nombreCliente, datos.marcaModelo]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(searchTerm.toLowerCase());
  });

  return (
    <main className="p-6 space-y-6">
      {/* Contenedor común */}
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="mt-1 text-gray-600">Bienvenido, {user?.email}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* ✅ BOTÓN NOTIFICACIONES */}
            <button
              onClick={handleEnableNotifications}
              disabled={pushStatus === "working"}
              className={`px-4 py-2 rounded-lg border-2 border-black shadow-lg transition
                ${
                  pushStatus === "enabled"
                    ? "bg-green-500 text-black hover:bg-green-600"
                    : "bg-yellow-400 text-black hover:bg-yellow-500"
                }
              `}
              title="Activa notificaciones push (Windows) para avisos de chat"
            >
              {pushStatus === "working"
                ? "🔔 Activando..."
                : pushStatus === "enabled"
                ? "🔔 Notificaciones ON"
                : "🔔 Activar notificaciones"}
            </button>

            <button
              onClick={handleSignOut}
              className="px-4 py-2 bg-red-500 text-black border-2 border-black rounded-lg shadow-lg hover:bg-red-600 transition flex items-center gap-2"
            >
              <span className="text-black text-lg leading-none">✖︎</span> Salir
            </button>
          </div>
        </header>

        {/* Acciones */}
        <div className="flex gap-4 mb-8 flex-wrap md:flex-nowrap justify-center">
          <button
            onClick={() => router.push("/calendario-citas")}
            className="flex-1 md:flex-none bg-pink-500 text-white px-4 py-2 rounded hover:bg-pink-600">
            Calendario de Citas
          </button>
          <button
            onClick={() => router.push("/cliente-form")}
            className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Nuevo Cuestionario
          </button>
          <button
            onClick={() => router.push("/diagnostico-form")}
            className="flex-1 md:flex-none bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
            Diagnósticos
          </button>
          <button
            onClick={() => router.push("/recambios-form")}
            className="flex-1 md:flex-none bg-blue-800 text-white px-4 py-2 rounded hover:bg-blue-900">
            Recambios
          </button>
          <button
            onClick={() => router.push("/chats")}
            className="flex-1 md:flex-none bg-fuchsia-600 text-white px-4 py-2 rounded hover:bg-fuchsia-700">
            Chats
          </button>
          <button
            onClick={() => router.push("/imagenes")}
            className="flex-1 md:flex-none bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
            Imágenes
          </button>
          <button
            onClick={() => router.push("/documentos")}
            className="flex-1 md:flex-none bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
            Documentos
          </button>
          <button
            onClick={() => router.push("/presupuestos-denegados")}
            className="flex-1 md:flex-none bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            Presupuestos Denegados
          </button>
          <button
            onClick={() => router.push("/trabajos-finalizados")}
            className="flex-1 md:flex-none bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Trabajos Finalizados
          </button>
        </div>
      </div>

      {/* Lista de cuestionarios */}
      <section className="mt-8 space-y-4 max-w-7xl mx-auto">
        <h2 className="text-2xl font-semibold">Cuestionarios guardados</h2>

        {/* Barra de búsqueda */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="🔍 Buscar matrícula, nº OR o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          />
        </div>

        {/* Filtro para mecánicos */}
        {userRol === "MECANICO" && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              id="onlyMine"
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
            />
            <label htmlFor="onlyMine">
              Ver sólo mis trabajos asignados
            </label>
          </div>
        )}

        {filteredItems.length === 0 ? (
          <p className="text-gray-600">No hay cuestionarios que coincidan.</p>
        ) : (
          filteredItems.map(({ id, datos, creadoEn }) => (
            <div
              key={id}
              className="flex justify-between items-center bg-white p-4 rounded shadow"
            >
              <div>
                <p className="font-medium flex items-center flex-wrap gap-2">
                  <span>
                    {datos.matricula} — {datos.numeroOR} — {datos.nombreCliente || ""}
                  </span>
                  {unreadMap?.[id] ? (
                    <span className="inline-flex items-center gap-2 px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white">
                      ● NUEVO MENSAJE
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-gray-500">
                  Creado: {creadoEn.toDate().toLocaleString()}
                </p>
              </div>
              <div className="space-x-5">
                <button
                  onClick={() => router.push(`/chat-trabajo/${id}`)}
                  className="text-fuchsia-700 hover:underline"
                >
                  Chat
                </button>
                <button
                  onClick={() => router.push(`/cliente-form/${id}?view=true`)}
                  className="text-indigo-600 hover:underline"
                >
                  Ver
                </button>
                <button
                  onClick={() => router.push(`/cliente-form/${id}?edit=true`)}
                  className="text-pink-500 hover:underline"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleRejectPresupuesto(id)}
                  className="text-yellow-600 hover:underline"
                >
                  Rechazar presupuesto
                </button>

                <button
                  onClick={() => handleFinalizar(id)}
                  className="text-green-600 hover:underline"
                >
                  Finalizar
                </button>

                <button
                  onClick={() => handleDelete(id)}
                  className="text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </main>
  );
}
