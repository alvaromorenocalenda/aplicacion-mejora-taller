// app/chat-trabajo/[cuestionarioId]/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export default function ChatTrabajoPage() {
  const router = useRouter();
  const { cuestionarioId } = useParams();
  const [loading, setLoading] = useState(true);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");

  const bottomRef = useRef(null);
  const lastMarkReadRef = useRef(0);

  const chatDocRef = useMemo(
    () => doc(db, "chats_trabajos", String(cuestionarioId)),
    [cuestionarioId]
  );

  // Un solo chat general por trabajo
  const mensajesColRef = useMemo(
    () => collection(db, "chats_trabajos", String(cuestionarioId), "messages"),
    [cuestionarioId]
  );

  async function markAsRead() {
    const u = auth.currentUser;
    if (!u) return;

    const now = Date.now();
    if (now - lastMarkReadRef.current < 4000) return; // anti-spam writes
    lastMarkReadRef.current = now;

    try {
      await setDoc(
        doc(db, "chats_trabajos", String(cuestionarioId), "reads", u.uid),
        { lastReadAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error("Error marcando chat como leído:", e);
    }
  }

  // Autenticación + asegurar documentos base
  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        // Crear doc raíz del chat (merge) si no existe
        await setDoc(
          chatDocRef,
          {
            cuestionarioId: String(cuestionarioId),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Guardar datos básicos del trabajo para listados (matrícula, OR, cliente)
        try {
          const cqRef = doc(db, "cuestionarios_cliente", String(cuestionarioId));
          const cqSnap = await getDoc(cqRef);
          if (cqSnap.exists()) {
            const datos = cqSnap.data()?.datos || {};
            await setDoc(
              chatDocRef,
              {
                matricula: datos.matricula || "",
                numeroOR: datos.numeroOR || "",
                nombreCliente: datos.nombreCliente || "",
                estadoPresupuesto: cqSnap.data()?.estadoPresupuesto || "",
              },
              { merge: true }
            );
          }
        } catch {
          // ignorar
        }
      } catch (e) {
        console.error("Error inicializando chat:", e);
      }
    })();
  }, [chatDocRef, cuestionarioId, router]);

  // Realtime listener
  useEffect(() => {
    const q = query(mensajesColRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMensajes(arr);
        setLoading(false);

        // marcar como leído (al recibir/sincronizar)
        markAsRead();

        // scroll al final
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      },
      (err) => {
        console.error("Error escuchando mensajes:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [mensajesColRef]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;

    const user = auth.currentUser;
    if (!user) return;

    setTexto("");

    try {
      await addDoc(mensajesColRef, {
        text: t,
        createdAt: serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName || user.email || "Usuario",
      });

      // Resumen para listados + quién fue el último en hablar
      await setDoc(
        chatDocRef,
        {
          lastMessage: t.slice(0, 180),
          updatedAt: serverTimestamp(),
          lastSenderUid: user.uid,
        },
        { merge: true }
      );

      // como lo acaba de enviar él, lo marcamos como leído para él
      markAsRead();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      // En caso de fallo, al menos reintentar guardar resumen del chat
      try {
        await setDoc(
          chatDocRef,
          {
            lastMessage: t.slice(0, 180),
            updatedAt: serverTimestamp(),
            lastSenderUid: user.uid,
          },
          { merge: true }
        );
      } catch (e2) {
        console.error("Error guardando resumen del chat:", e2);
      }
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold">Chat del trabajo</h1>
          <p className="text-sm text-gray-500 break-all">
            ID trabajo: {String(cuestionarioId)}
          </p>
        </div>

        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Volver
        </button>
      </div>

      {/* Mensajes */}
      <div className="border rounded-xl bg-white shadow p-4 h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500">Cargando chat…</p>
        ) : mensajes.length === 0 ? (
          <p className="text-center text-gray-500">Aún no hay mensajes.</p>
        ) : (
          <div className="space-y-3">
            {mensajes.map((m) => {
              const mine = auth.currentUser?.uid && m.uid === auth.currentUser.uid;
              return (
                <div
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow ${
                      mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                    }`}
                  >
                    <div className="text-[11px] opacity-80 mb-1">
                      {mine ? "Tú" : m.displayName || "Usuario"}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={enviar} className="mt-4 flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
        >
          Enviar
        </button>
      </form>
    </main>
  );
}
