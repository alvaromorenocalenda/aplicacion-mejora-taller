// app/chats/page.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

import { subscribeUserProfile } from "../../lib/userProfile";

export default function ChatsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");

  const [userRol, setUserRol] = useState("ADMIN");
  const [onlyMine, setOnlyMine] = useState(false);

  const q = useMemo(
    () => query(collection(db, "chats_trabajos"), orderBy("updatedAt", "desc")),
    []
  );

  // 1) Comprobar sesión
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) router.replace("/login");
    });
    return unsub;
  }, [router]);

  // 2) Rol de usuario (para limitar trabajos a un mecánico)
  useEffect(() => {
    if (!user) return;
    return subscribeUserProfile(user.uid, (p) => {
      const rol = (p?.rol || "ADMIN").toUpperCase();
      setUserRol(rol);
      if (rol === "MECANICO") setOnlyMine(true);
      else setOnlyMine(false);
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      q,
      async (snap) => {
        // Enriquecer con datos del cuestionario (matrícula, OR, cliente)
        const base = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const enriched = await Promise.all(
          base.map(async (c) => {
            const cuestionarioId = String(c.cuestionarioId || c.id);
            try {
              const cq = await getDoc(
                doc(db, "cuestionarios_cliente", cuestionarioId)
              );
              if (cq.exists()) {
                const datos = cq.data()?.datos || {};
                return {
                  ...c,
                  cuestionarioId,
                  matricula: datos.matricula || "",
                  numeroOR: datos.numeroOR || "",
                  nombreCliente: datos.nombreCliente || "",
                  estadoPresupuesto: cq.data()?.estadoPresupuesto || "",
                  asignadoMecanicoUid: cq.data()?.asignadoMecanicoUid || null,
                  asignadoMecanicoNombre: cq.data()?.asignadoMecanicoNombre || null,
                };
              }
            } catch {
              // ignorar
            }
            return {
              ...c,
              cuestionarioId,
              matricula: c.matricula || "",
              numeroOR: c.numeroOR || "",
              nombreCliente: c.nombreCliente || "",
              estadoPresupuesto: c.estadoPresupuesto || "",
              asignadoMecanicoUid: c.asignadoMecanicoUid || null,
              asignadoMecanicoNombre: c.asignadoMecanicoNombre || null,
            };
          })
        );

        // ✅ calcular no-leídos por usuario (reads/{uid}.lastReadAt)
        const uid = user?.uid;

        if (uid) {
          try {
            const withUnread = await Promise.all(
              enriched.map(async (c) => {
                const readRef = doc(db, "chats_trabajos", c.id, "reads", uid);
                const readSnap = await getDoc(readRef);

                const lastReadMs = readSnap.exists()
                  ? readSnap.data()?.lastReadAt?.toMillis?.() || 0
                  : 0;

                const updatedMs =
                  c.updatedAt?.toMillis?.() ||
                  (c.updatedAt?.seconds ? c.updatedAt.seconds * 1000 : 0) ||
                  0;

                // Hay no-leído si:
                // - el chat se actualizó después de tu última lectura
                // - y el último mensaje NO lo has enviado tú
                const unread =
                  updatedMs > lastReadMs &&
                  c.lastSenderUid &&
                  c.lastSenderUid !== uid;

                return { ...c, unread };
              })
            );

            setItems(withUnread);
            setLoading(false);
            return;
          } catch (e) {
            console.error("Error calculando no-leídos:", e);
          }
        }

        setItems(enriched);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando chats:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [q, router, user]);

  const visibleItems = useMemo(() => {
    if (userRol === "MECANICO" && onlyMine && user?.uid) {
      return items.filter((c) => c.asignadoMecanicoUid === user.uid);
    }
    return items;
  }, [items, onlyMine, user, userRol]);

  const filtered = visibleItems.filter((c) => {
    const hay = [
      c.matricula,
      c.numeroOR,
      c.nombreCliente,
      c.cuestionarioId,
      c.lastMessage,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Chats</h1>
          <p className="text-gray-600">Todos los chats de trabajos</p>
        </div>
        <div className="flex gap-2">
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

      <div className="relative">
        <input
          type="text"
          placeholder="🔍 Buscar matrícula, OR, cliente o mensaje..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg border-2 border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
        />
      </div>

      {userRol === "MECANICO" ? (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="h-4 w-4"
          />
          Ver sólo mis trabajos asignados
        </label>
      ) : null}

      {loading ? (
        <p className="text-gray-600">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-600">No hay chats.</p>
      ) : (
        <section className="space-y-3">
          {filtered.map((c) => {
            const id = String(c.cuestionarioId || c.id);
            const when = c.updatedAt?.toDate
              ? c.updatedAt.toDate().toLocaleString()
              : "";
            return (
              <div
                key={id}
                className="bg-white p-4 rounded shadow flex justify-between items-center gap-3 flex-wrap"
              >
                <div className="min-w-[260px]">
                  <div className="font-semibold flex items-center flex-wrap gap-2">
                    <span>
                      {(c.matricula || "(sin matrícula)") +
                        " — " +
                        (c.numeroOR || "")}
                    </span>

                    {c.unread ? (
                      <span className="inline-flex items-center gap-2 px-2 py-1 text-xs font-bold rounded-full bg-red-600 text-white">
                        ● NUEVO
                      </span>
                    ) : null}
                  </div>

                  {c.nombreCliente ? (
                    <div className="text-sm text-gray-600">{c.nombreCliente}</div>
                  ) : null}

                  <div className="text-xs text-gray-500 break-all">ID: {id}</div>

                  {c.lastMessage ? (
                    <div className="text-sm text-gray-700 mt-1">
                      💬 {c.lastMessage}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-1">
                      (sin mensajes)
                    </div>
                  )}

                  {when ? (
                    <div className="text-xs text-gray-500 mt-1">
                      Actualizado: {when}
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => router.push(`/chat-trabajo/${id}`)}
                    className="px-4 py-2 bg-pink-500 text-white rounded hover:bg-pink-600"
                  >
                    Abrir chat
                  </button>
                  <button
                    onClick={() => router.push(`/cliente-form/${id}?view=true`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Ver trabajo
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </main>
  );
}
