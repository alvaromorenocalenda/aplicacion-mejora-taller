"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const norm = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const datosObjeto = (d) => d && typeof d === "object" && !Array.isArray(d) ? d : {};

function textoTrabajo(id, datos, extra = {}) {
  return [
    id,
    datos?.matricula,
    datos?.numeroOR,
    datos?.nombreCliente,
    datos?.nombre,
    datos?.telefonoCliente,
    datos?.marcaModelo,
    extra?.lastMessage,
    extra?.lastText,
  ].filter(Boolean).join(" ");
}

export default function GlobalSearchBar() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const cleanTerm = useMemo(() => norm(term), [term]);

  const buscar = async () => {
    if (!cleanTerm || cleanTerm.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    try {
      const [cqSnap, chSnap, rSnap, chatSnap] = await Promise.all([
        getDocs(collection(db, "cuestionarios_cliente")),
        getDocs(collection(db, "checklists")),
        getDocs(collection(db, "recambios")),
        getDocs(collection(db, "chats_trabajos")),
      ]);

      const cuestionarios = cqSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const checklists = chSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const recambios = rSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const chats = chatSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      const cqMap = new Map(cuestionarios.map((x) => [x.id, x]));
      const chMap = new Map(checklists.map((x) => [x.id, x]));
      const chatIds = new Set(chats.map((x) => x.id));
      const groups = new Map();

      const ensure = (id, baseDatos = {}) => {
        const key = String(id || "");
        if (!key) return null;
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            datos: baseDatos,
            hasCuestionario: cqMap.has(key),
            hasChecklist: false,
            checklistId: key,
            hasRecambios: false,
            recambiosId: key,
            hasChat: chatIds.has(key),
          });
        } else if (Object.keys(baseDatos || {}).length) {
          const g = groups.get(key);
          g.datos = { ...baseDatos, ...datosObjeto(g.datos) };
        }
        return groups.get(key);
      };

      cuestionarios.forEach((c) => {
        const d = datosObjeto(c.datos);
        if (norm(textoTrabajo(c.id, d, c)).includes(cleanTerm)) ensure(c.id, d);
      });

      checklists.forEach((ch) => {
        const cuestionarioId = ch.cuestionarioId || ch.id;
        const d = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(ch.datos) };
        if (norm(textoTrabajo(ch.id, d, ch)).includes(cleanTerm) || norm(textoTrabajo(cuestionarioId, d, ch)).includes(cleanTerm)) {
          const g = ensure(cuestionarioId, d);
          if (g) { g.hasChecklist = true; g.checklistId = ch.id; }
        }
      });

      recambios.forEach((r) => {
        const checklistId = r.checklistId || r.id;
        const checklist = chMap.get(checklistId) || {};
        const cuestionarioId = r.cuestionarioId || checklist.cuestionarioId || checklistId || r.id;
        const d = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(checklist.datos), ...datosObjeto(r.datos) };
        if (norm(textoTrabajo(r.id, d, r)).includes(cleanTerm) || norm(textoTrabajo(cuestionarioId, d, r)).includes(cleanTerm)) {
          const g = ensure(cuestionarioId, d);
          if (g) { g.hasRecambios = true; g.recambiosId = r.id; }
        }
      });

      chats.forEach((chat) => {
        const cuestionarioId = chat.cuestionarioId || chat.trabajoId || chat.id;
        const baseDatos = datosObjeto(cqMap.get(cuestionarioId)?.datos);
        if (norm(textoTrabajo(cuestionarioId, baseDatos, chat)).includes(cleanTerm)) {
          const g = ensure(cuestionarioId, baseDatos);
          if (g) g.hasChat = true;
        }
      });

      // Si se encontró un cuestionario, damos acceso igualmente a checklist/recambios/chat de esa referencia.
      const final = Array.from(groups.values()).map((g) => ({
        ...g,
        hasCuestionario: g.hasCuestionario || cqMap.has(g.id),
        hasChat: g.hasChat || chatIds.has(g.id),
      })).slice(0, 8);
      setResults(final);
    } catch (e) {
      console.error("Error en buscador global:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const abrir = (url) => {
    setOpen(false);
    setTerm("");
    router.push(url);
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="flex rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") buscar(); if (e.key === "Escape") setOpen(false); }}
          placeholder="Buscar matrícula u OR..."
          className="min-w-0 flex-1 px-4 py-2 text-sm outline-none"
        />
        <button onClick={buscar} className="bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          {loading ? <p className="p-3 text-sm text-slate-500">Buscando…</p> : results.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No se han encontrado coincidencias.</p>
          ) : results.map((r) => {
            const d = datosObjeto(r.datos);
            return (
              <div key={r.id} className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3 last:mb-0">
                <p className="font-black text-slate-900">{d.matricula || "Sin matrícula"} — {d.numeroOR || "Sin OR"}</p>
                <p className="text-xs text-slate-600">{d.nombreCliente || d.nombre || "Sin cliente"} {d.marcaModelo ? `· ${d.marcaModelo}` : ""}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button onClick={() => abrir(`/cliente-form/${encodeURIComponent(r.id)}?view=true`)} className="rounded-lg bg-indigo-600 px-2 py-2 text-xs font-bold text-white">Cuestionario</button>
                  <button onClick={() => abrir(`/diagnostico-form/${encodeURIComponent(r.checklistId || r.id)}/detalle`)} className="rounded-lg bg-yellow-500 px-2 py-2 text-xs font-bold text-white">Checklist</button>
                  <button onClick={() => abrir(`/recambios-form/${encodeURIComponent(r.recambiosId || r.checklistId || r.id)}/detalle`)} className="rounded-lg bg-blue-800 px-2 py-2 text-xs font-bold text-white">Recambios</button>
                  <button onClick={() => abrir(`/chat-trabajo/${encodeURIComponent(r.id)}`)} className="rounded-lg bg-fuchsia-600 px-2 py-2 text-xs font-bold text-white">Chat</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
