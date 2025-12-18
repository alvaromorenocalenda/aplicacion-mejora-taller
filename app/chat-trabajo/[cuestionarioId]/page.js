// app/chat-trabajo/[cuestionarioId]/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
  updateDoc,
} from "firebase/firestore";

const CANALES = [
  { id: "general", label: "General" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "recambios", label: "Recambios" },
];

export default function ChatTrabajoPage() {
  const router = useRouter();
  const { cuestionarioId } = useParams();
  const searchParams = useSearchParams();

  const initialCanal = searchParams.get("canal") || "general";

  const [canal, setCanal] = useState(initialCanal);
  const [loading, setLoading] = useState(true);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");

  const bottomRef = useRef(null);

  const chatDocRef = useMemo(
    () => doc(db, "chats_trabajos", String(cuestionarioId)),
    [cuestionarioId]
  );

  const canalDocRef = useMemo(
    () => doc(db, "chats_trabajos", String(cuestionarioId), "canales", canal),
    [cuestionarioId, canal]
  );

  const mensajesColRef = useMemo(
    () =>
      collection(
        db,
        "chats_trabajos",
        String(cuestionarioId),
        "canales",
        canal,
        "messages"
      ),
    [cuestionarioId, canal]
  );

  // Mantener canal sincronizado si cambia la query (por ejemplo desde botones)
  useEffect(() => {
    const q = searchParams.get("canal") || "general";
    setCanal(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

        // Crear doc del canal (merge) si no existe
        await setDoc(
          canalDocRef,
          {
            canal,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.error("Error inicializando chat:", e);
      }
    })();
  }, [chatDocRef, canalDocRef, canal, cuestionarioId, router]);

  // Realtime listener
  useEffect(() => {
    const q = query(mensajesColRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMensajes(arr);
        setLoading(false);
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

      // Resumen para listados
      const resumen = {
        lastMessage: t.slice(0, 180),
        lastChannel: canal,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(chatDocRef, resumen);
      await updateDoc(canalDocRef, {
        lastMessage: resumen.lastMessage,
        updatedAt: resumen.updatedAt,
      });
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      // Si falla el updateDoc porque no existe aún, lo aseguramos con setDoc merge
      try {
        await setDoc(
          chatDocRef,
          {
            lastMessage: t.slice(0, 180),
            lastChannel: canal,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await setDoc(
          canalDocRef,
          {
            lastMessage: t.slice(0, 180),
            updatedAt: serverTimestamp(),
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

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CANALES.map((c) => {
          const active = c.id === canal;
          return (
            <button
              key={c.id}
              onClick={() => router.push(`/chat-trabajo/${cuestionarioId}?canal=${c.id}`)}
              className={`px-3 py-2 rounded text-sm font-semibold border ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Mensajes */}
      <div className="border rounded-xl bg-white shadow p-4 h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500">Cargando chat…</p>
        ) : mensajes.length === 0 ? (
          <p className="text-center text-gray-500">
            Aún no hay mensajes en <b>{canal}</b>.
          </p>
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
                      mine
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-900"
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
          placeholder={`Mensaje en ${canal}…`}
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
