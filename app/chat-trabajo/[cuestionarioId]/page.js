// app/chat-trabajo/[cuestionarioId]/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "../../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
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

function formatFechaHora(ts) {
  if (!ts) return "";
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

function safeName(name) {
  return String(name || "imagen.jpg").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export default function ChatTrabajoPage() {
  const router = useRouter();
  const params = useParams();
  const cuestionarioId = decodeURIComponent(params.cuestionarioId);
  const [loading, setLoading] = useState(true);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [imagen, setImagen] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastMarkReadRef = useRef(0);

  const chatDocRef = useMemo(() => doc(db, "chats_trabajos", String(cuestionarioId)), [cuestionarioId]);
  const mensajesColRef = useMemo(() => collection(db, "chats_trabajos", String(cuestionarioId), "messages"), [cuestionarioId]);

  async function markAsRead() {
    const u = auth.currentUser;
    if (!u) return;
    const now = Date.now();
    if (now - lastMarkReadRef.current < 4000) return;
    lastMarkReadRef.current = now;
    try {
      await setDoc(doc(db, "chats_trabajos", String(cuestionarioId), "reads", u.uid), { lastReadAt: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error("Error marcando chat como leído:", e);
    }
  }

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        await setDoc(chatDocRef, { cuestionarioId: String(cuestionarioId), updatedAt: serverTimestamp() }, { merge: true });
        try {
          const cqRef = doc(db, "cuestionarios_cliente", String(cuestionarioId));
          const cqSnap = await getDoc(cqRef);
          if (cqSnap.exists()) {
            const datos = cqSnap.data()?.datos || {};
            await setDoc(chatDocRef, {
              matricula: datos.matricula || "",
              numeroOR: datos.numeroOR || "",
              nombreCliente: datos.nombreCliente || "",
              estadoPresupuesto: cqSnap.data()?.estadoPresupuesto || "",
            }, { merge: true });
          }
        } catch {}
      } catch (e) {
        console.error("Error inicializando chat:", e);
      }
    })();
  }, [chatDocRef, cuestionarioId, router]);

  useEffect(() => {
    const q = query(mensajesColRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      markAsRead();
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }, (err) => {
      console.error("Error escuchando mensajes:", err);
      setLoading(false);
    });
    return () => unsub();
  }, [mensajesColRef]);

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t && !imagen) return;
    const user = auth.currentUser;
    if (!user) return;

    setEnviando(true);
    setTexto("");

    try {
      let imageUrl = "";
      let imageName = "";
      let imagePath = "";

      if (imagen) {
        imageName = imagen.name;
        imagePath = `chat_imagenes/${String(cuestionarioId)}/${Date.now()}-${safeName(imagen.name)}`;
        const storageRef = ref(storage, imagePath);
        await uploadBytes(storageRef, imagen);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(mensajesColRef, {
        text: t,
        imageUrl,
        imageName,
        imagePath,
        createdAt: serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName || user.email || "Usuario",
      });

      const lastMessage = imageUrl ? (t ? `📷 Imagen: ${t}` : "📷 Imagen") : t;
      await setDoc(chatDocRef, {
        lastMessage: lastMessage.slice(0, 180),
        updatedAt: serverTimestamp(),
        lastSenderUid: user.uid,
      }, { merge: true });

      setImagen(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      markAsRead();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      alert("No se ha podido enviar el mensaje o la imagen.");
      setTexto(t);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-2xl font-bold">Chat del trabajo</h1>
          <p className="text-sm text-gray-500 break-all">ID trabajo: {String(cuestionarioId)}</p>
        </div>
        <button onClick={() => router.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Volver</button>
      </div>

      <div className="border rounded-xl bg-white shadow p-4 h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500">Cargando chat…</p>
        ) : mensajes.length === 0 ? (
          <p className="text-center text-gray-500">Aún no hay mensajes.</p>
        ) : (
          <div className="space-y-3">
            {mensajes.map((m) => {
              const mine = auth.currentUser?.uid && m.uid === auth.currentUser.uid;
              const when = formatFechaHora(m.createdAt);
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow ${mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <div className="text-[11px] opacity-80">{mine ? "Tú" : m.displayName || "Usuario"}</div>
                      {when ? <div className="text-[10px] opacity-70 whitespace-nowrap">{when}</div> : null}
                    </div>
                    {m.imageUrl ? (
                      <button type="button" onClick={() => window.open(m.imageUrl, "_blank")} className="block mb-2">
                        <img src={m.imageUrl} alt={m.imageName || "Imagen del chat"} className="max-h-64 rounded-lg object-contain bg-white" />
                      </button>
                    ) : null}
                    {m.text ? <div className="whitespace-pre-wrap break-words">{m.text}</div> : null}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={enviar} className="mt-4 space-y-2">
        {imagen ? (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex justify-between items-center gap-3">
            <span className="text-sm text-blue-900 truncate">📷 {imagen.name}</span>
            <button type="button" onClick={() => { setImagen(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-red-600 font-semibold text-sm">Quitar</button>
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un mensaje…"
            className="flex-1 border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <label className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 cursor-pointer">
            📷
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => setImagen(e.target.files?.[0] || null)} className="hidden" />
          </label>
          <button type="submit" disabled={enviando} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60">
            {enviando ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </form>
    </main>
  );
}
