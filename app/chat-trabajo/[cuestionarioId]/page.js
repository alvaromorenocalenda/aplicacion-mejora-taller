// app/chat-trabajo/[cuestionarioId]/page.js
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db, storage } from "../../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";

function formatFechaHora(ts) {
  if (!ts) return "";
  try {
    const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
  } catch { return ""; }
}
function safeName(name) { return String(name || "archivo").replace(/[^a-zA-Z0-9._-]/g, "_"); }
function resumenMensaje(m) {
  if (!m) return "Mensaje";
  if (m.text) return m.text.slice(0, 90);
  if (m.imageUrl) return "📷 Imagen";
  if (m.audioUrl) return "🎙️ Audio";
  return "Mensaje";
}

export default function ChatTrabajoPage() {
  const router = useRouter();
  const params = useParams();
  const cuestionarioId = decodeURIComponent(params.cuestionarioId);
  const [loading, setLoading] = useState(true);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [imagen, setImagen] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recording, setRecording] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [chatInfo, setChatInfo] = useState({});
  const [mostrarOpcionesImagen, setMostrarOpcionesImagen] = useState(false);

  const bottomRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const lastMarkReadRef = useRef(0);

  const chatDocRef = useMemo(() => doc(db, "chats_trabajos", String(cuestionarioId)), [cuestionarioId]);
  const mensajesColRef = useMemo(() => collection(db, "chats_trabajos", String(cuestionarioId), "messages"), [cuestionarioId]);

  function seleccionarImagen(file) {
    setImagen(file || null);
    setMostrarOpcionesImagen(false);
  }

  function limpiarImagen() {
    setImagen(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  async function crearNotificacion(titulo, mensaje, tipo = "chat") {
    try {
      await addDoc(collection(db, "notificaciones"), {
        titulo,
        mensaje,
        tipo,
        trabajoId: String(cuestionarioId),
        matricula: chatInfo.matricula || "",
        numeroOR: chatInfo.numeroOR || "",
        url: `/chat-trabajo/${encodeURIComponent(String(cuestionarioId))}`,
        leida: false,
        creadoEn: serverTimestamp(),
        creadoPorUid: auth.currentUser?.uid || "",
        creadoPorNombre: auth.currentUser?.displayName || auth.currentUser?.email || "Usuario",
        destinatarioRol: "ASESOR",
      });
    } catch (e) { console.error("Error creando notificación:", e); }
  }

  async function markAsRead() {
    const u = auth.currentUser;
    if (!u) return;
    const now = Date.now();
    if (now - lastMarkReadRef.current < 4000) return;
    lastMarkReadRef.current = now;
    try { await setDoc(doc(db, "chats_trabajos", String(cuestionarioId), "reads", u.uid), { lastReadAt: serverTimestamp() }, { merge: true }); }
    catch (e) { console.error("Error marcando chat como leído:", e); }
  }

  useEffect(() => {
    if (!auth.currentUser) { router.replace("/login"); return; }
    (async () => {
      try {
        await setDoc(chatDocRef, { cuestionarioId: String(cuestionarioId), updatedAt: serverTimestamp() }, { merge: true });
        const chatSnap = await getDoc(chatDocRef);
        if (chatSnap.exists()) setChatInfo(chatSnap.data() || {});
        const cqRef = doc(db, "cuestionarios_cliente", String(cuestionarioId));
        const cqSnap = await getDoc(cqRef);
        if (cqSnap.exists()) {
          const datos = cqSnap.data()?.datos || {};
          const info = { matricula: datos.matricula || "", numeroOR: datos.numeroOR || "", nombreCliente: datos.nombreCliente || "", estadoPresupuesto: cqSnap.data()?.estadoPresupuesto || "" };
          setChatInfo((p) => ({ ...p, ...info }));
          await setDoc(chatDocRef, info, { merge: true });
        }
      } catch (e) { console.error("Error inicializando chat:", e); }
    })();
  }, [chatDocRef, cuestionarioId, router]);

  useEffect(() => {
    const q = query(mensajesColRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      setMensajes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      markAsRead();
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    }, (err) => { console.error("Error escuchando mensajes:", err); setLoading(false); });
    return () => unsub();
  }, [mensajesColRef]);

  async function iniciarGrabacion() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => { setAudioBlob(new Blob(chunksRef.current, { type: "audio/webm" })); stream.getTracks().forEach((t) => t.stop()); };
      recorder.start();
      setRecording(true);
    } catch (e) { console.error(e); alert("No se ha podido acceder al micrófono."); }
  }
  function pararGrabacion() { mediaRecorderRef.current?.stop(); setRecording(false); }

  async function enviar(e) {
    e.preventDefault();
    const t = texto.trim();
    if (!t && !imagen && !audioBlob) return;
    const user = auth.currentUser;
    if (!user) return;
    setEnviando(true);
    setTexto("");
    try {
      let imageUrl = "", imageName = "", imagePath = "";
      let audioUrl = "", audioName = "", audioPath = "";
      if (imagen) {
        imageName = imagen.name;
        imagePath = `chat_imagenes/${String(cuestionarioId)}/${Date.now()}-${safeName(imagen.name)}`;
        const storageRef = ref(storage, imagePath);
        await uploadBytes(storageRef, imagen);
        imageUrl = await getDownloadURL(storageRef);
      }
      if (audioBlob) {
        audioName = `audio-${Date.now()}.webm`;
        audioPath = `chat_audios/${String(cuestionarioId)}/${audioName}`;
        const audioRef = ref(storage, audioPath);
        await uploadBytes(audioRef, audioBlob);
        audioUrl = await getDownloadURL(audioRef);
      }
      await addDoc(mensajesColRef, {
        text: t,
        imageUrl, imageName, imagePath,
        audioUrl, audioName, audioPath,
        replyTo: replyTo ? { id: replyTo.id, text: resumenMensaje(replyTo), displayName: replyTo.displayName || "Usuario" } : null,
        createdAt: serverTimestamp(),
        uid: user.uid,
        displayName: user.displayName || user.email || "Usuario",
      });
      const lastMessage = audioUrl ? (t ? `🎙️ Audio: ${t}` : "🎙️ Audio") : imageUrl ? (t ? `📷 Imagen: ${t}` : "📷 Imagen") : t;
      await setDoc(chatDocRef, { lastMessage: lastMessage.slice(0, 180), updatedAt: serverTimestamp(), lastSenderUid: user.uid }, { merge: true });
      await crearNotificacion("Nuevo mensaje en chat", `${user.displayName || user.email || "Usuario"}: ${lastMessage.slice(0, 120)}`);
      limpiarImagen();
      setAudioBlob(null); setReplyTo(null);
      markAsRead();
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      alert("No se ha podido enviar el mensaje, imagen o audio.");
      setTexto(t);
    } finally { setEnviando(false); }
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div><h1 className="text-2xl font-bold">Chat del trabajo</h1><p className="text-sm text-gray-500 break-all">ID trabajo: {String(cuestionarioId)}</p></div>
        <button onClick={() => router.back()} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Volver</button>
      </div>
      <div className="border rounded-xl bg-white shadow p-4 h-[60vh] overflow-y-auto">
        {loading ? <p className="text-center text-gray-500">Cargando chat…</p> : mensajes.length === 0 ? <p className="text-center text-gray-500">Aún no hay mensajes.</p> : <div className="space-y-3">
          {mensajes.map((m) => {
            const mine = auth.currentUser?.uid && m.uid === auth.currentUser.uid;
            const when = formatFechaHora(m.createdAt);
            return <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow ${mine ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"}`}>
                <div className="flex items-baseline justify-between gap-3 mb-1"><div className="text-[11px] opacity-80">{mine ? "Tú" : m.displayName || "Usuario"}</div>{when ? <div className="text-[10px] opacity-70 whitespace-nowrap">{when}</div> : null}</div>
                {m.replyTo ? <div className={`mb-2 rounded border-l-4 px-2 py-1 text-xs ${mine ? "bg-blue-700/50 border-white/70" : "bg-white border-blue-500"}`}><b>Respuesta a {m.replyTo.displayName || "Usuario"}</b><br />{m.replyTo.text}</div> : null}
                {m.imageUrl ? <button type="button" onClick={() => window.open(m.imageUrl, "_blank")} className="block mb-2"><img src={m.imageUrl} alt={m.imageName || "Imagen del chat"} className="max-h-64 rounded-lg object-contain bg-white" /></button> : null}
                {m.audioUrl ? <audio src={m.audioUrl} controls className="w-full my-2" /> : null}
                {m.text ? <div className="whitespace-pre-wrap break-words">{m.text}</div> : null}
                <button type="button" onClick={() => setReplyTo(m)} className={`mt-2 text-[11px] underline ${mine ? "text-blue-100" : "text-blue-700"}`}>Responder</button>
              </div>
            </div>;
          })}
          <div ref={bottomRef} />
        </div>}
      </div>
      <form onSubmit={enviar} className="mt-4 space-y-2">
        {replyTo ? <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 flex justify-between items-center gap-3"><span className="text-sm text-yellow-900 truncate">Respondiendo a {replyTo.displayName || "Usuario"}: {resumenMensaje(replyTo)}</span><button type="button" onClick={() => setReplyTo(null)} className="text-red-600 font-semibold text-sm">Quitar</button></div> : null}
        {imagen ? <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex justify-between items-center gap-3"><span className="text-sm text-blue-900 truncate">📷 Imagen preparada: {imagen.name}</span><button type="button" onClick={limpiarImagen} className="text-red-600 font-semibold text-sm">Quitar</button></div> : null}
        {audioBlob ? <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-2 flex justify-between items-center gap-3"><span className="text-sm text-purple-900">🎙️ Audio preparado para enviar</span><button type="button" onClick={() => setAudioBlob(null)} className="text-red-600 font-semibold text-sm">Quitar</button></div> : null}
        {recording ? <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm font-semibold text-red-700 animate-pulse">🔴 Grabando audio... pulsa “Detener grabación” cuando termines.</div> : null}
        {mostrarOpcionesImagen ? <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => cameraInputRef.current?.click()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700">📸 Abrir cámara</button>
          <button type="button" onClick={() => galleryInputRef.current?.click()} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">🖼️ Elegir de galería</button>
          <button type="button" onClick={() => setMostrarOpcionesImagen(false)} className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600">Cancelar</button>
        </div> : null}
        <div className="flex flex-wrap gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe un mensaje…" className="flex-1 min-w-[220px] border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400" />
          <button type="button" onClick={() => setMostrarOpcionesImagen((v) => !v)} className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700">📷 Imagen</button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={(e) => seleccionarImagen(e.target.files?.[0])} className="hidden" />
          <input ref={galleryInputRef} type="file" accept="image/*" onChange={(e) => seleccionarImagen(e.target.files?.[0])} className="hidden" />
          <button type="button" onClick={recording ? pararGrabacion : iniciarGrabacion} className={`px-4 py-3 text-white rounded-xl font-semibold ${recording ? "bg-red-600 hover:bg-red-700" : "bg-purple-600 hover:bg-purple-700"}`}>{recording ? "Detener grabación" : "🎙️ Grabar audio"}</button>
          <button type="submit" disabled={enviando} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60">{enviando ? "Enviando…" : "Enviar"}</button>
        </div>
      </form>
    </main>
  );
}
