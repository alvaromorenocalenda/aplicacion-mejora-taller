"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

const norm = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const datosObjeto = (d) => d && typeof d === "object" && !Array.isArray(d) ? d : {};
const estadoLegible = (estado) => {
  const e = String(estado || "").toUpperCase();
  if (e === "PENDIENTE_PRESUPUESTO") return "Pendiente";
  if (e === "FINALIZADO") return "Finalizado";
  if (e === "DENEGADO") return "Denegado";
  if (e === "EN_PROCESO") return "En proceso";
  return String(estado || "").replaceAll("_", " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());
};
const estadoColor = (estado) => {
  const e = String(estado || "").toUpperCase();
  if (e === "FINALIZADO") return "bg-green-100 text-green-800";
  if (e === "DENEGADO") return "bg-red-100 text-red-800";
  if (e === "PENDIENTE_PRESUPUESTO") return "bg-yellow-100 text-yellow-800";
  return "bg-slate-200 text-slate-700";
};
const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const fechaItem = (item = {}) => Math.max(
  toMillis(item.fechaFinalizado),
  toMillis(item.fechaDenegado),
  toMillis(item.updatedAt),
  toMillis(item.actualizadoEn),
  toMillis(item.createdAt),
  toMillis(item.creadoEn),
  toMillis(item.fechaSubida),
  toMillis(item.fecha),
  0
);

function textoTrabajo(id, datos, extra = {}) {
  return [
    id,
    datos?.matricula,
    datos?.numeroOR,
    datos?.nombreCliente,
    datos?.nombre,
    datos?.telefonoCliente,
    datos?.marcaModelo,
    extra?.matricula,
    extra?.numeroOR,
    extra?.nombreCliente,
    extra?.nombre,
    extra?.cliente,
    extra?.titulo,
    extra?.filename,
    extra?.nombreArchivo,
    extra?.categoria,
    extra?.lastMessage,
    extra?.lastText,
  ].filter(Boolean).join(" ");
}

async function getCollectionSafe(name) {
  try {
    const snap = await getDocs(collection(db, name));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
  } catch (e) {
    console.warn(`No se pudo cargar ${name} en buscador global`, e);
    return [];
  }
}

export default function GlobalSearchBar() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const cleanTerm = useMemo(() => norm(term), [term]);
  const lastSearchRef = useRef(0);

  const buscar = async (forcedTerm = cleanTerm) => {
    const currentTerm = norm(forcedTerm);
    if (!currentTerm || currentTerm.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    const searchId = Date.now();
    lastSearchRef.current = searchId;
    setLoading(true);
    setOpen(true);
    try {
      const [cuestionarios, checklists, recambios, chats, imagenes, documentos] = await Promise.all([
        getCollectionSafe("cuestionarios_cliente"),
        getCollectionSafe("checklists"),
        getCollectionSafe("recambios"),
        getCollectionSafe("chats_trabajos"),
        getCollectionSafe("imagenes_vehiculo"),
        getCollectionSafe("documentos"),
      ]);

      if (lastSearchRef.current !== searchId) return;

      const cqMap = new Map(cuestionarios.map((x) => [x.id, x]));
      const chMap = new Map(checklists.map((x) => [x.id, x]));
      const chatIds = new Set(chats.map((x) => x.id));
      const groups = new Map();

      const ensure = (id, baseDatos = {}, extra = {}) => {
        const key = String(id || "");
        if (!key) return null;
        const fecha = Math.max(fechaItem(extra), fechaItem(cqMap.get(key) || {}));
        if (!groups.has(key)) {
          groups.set(key, {
            id: key,
            datos: baseDatos,
            fechaOrden: fecha,
            estadoPresupuesto: extra.estadoPresupuesto || cqMap.get(key)?.estadoPresupuesto || "",
            hasCuestionario: cqMap.has(key),
            hasChecklist: false,
            checklistId: key,
            hasRecambios: false,
            recambiosId: key,
            hasChat: chatIds.has(key),
            hasImagenes: false,
            hasDocumentos: false,
          });
        } else {
          const g = groups.get(key);
          if (Object.keys(baseDatos || {}).length) g.datos = { ...baseDatos, ...datosObjeto(g.datos) };
          g.fechaOrden = Math.max(g.fechaOrden || 0, fecha);
          g.estadoPresupuesto = g.estadoPresupuesto || extra.estadoPresupuesto || "";
        }
        return groups.get(key);
      };

      cuestionarios.forEach((c) => {
        const d = datosObjeto(c.datos);
        if (norm(textoTrabajo(c.id, d, c)).includes(currentTerm)) ensure(c.id, d, c);
      });

      checklists.forEach((ch) => {
        const cuestionarioId = ch.cuestionarioId || ch.id;
        const d = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(ch.datos) };
        if (norm(textoTrabajo(ch.id, d, ch)).includes(currentTerm) || norm(textoTrabajo(cuestionarioId, d, ch)).includes(currentTerm)) {
          const g = ensure(cuestionarioId, d, ch);
          if (g) { g.hasChecklist = true; g.checklistId = ch.id; }
        }
      });

      recambios.forEach((r) => {
        const checklistId = r.checklistId || r.id;
        const checklist = chMap.get(checklistId) || {};
        const cuestionarioId = r.cuestionarioId || checklist.cuestionarioId || checklistId || r.id;
        const d = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(checklist.datos), ...datosObjeto(r.datos) };
        if (norm(textoTrabajo(r.id, d, r)).includes(currentTerm) || norm(textoTrabajo(cuestionarioId, d, r)).includes(currentTerm)) {
          const g = ensure(cuestionarioId, d, r);
          if (g) { g.hasRecambios = true; g.recambiosId = r.id; }
        }
      });

      chats.forEach((chat) => {
        const cuestionarioId = chat.cuestionarioId || chat.trabajoId || chat.id;
        const baseDatos = datosObjeto(cqMap.get(cuestionarioId)?.datos);
        if (norm(textoTrabajo(cuestionarioId, baseDatos, chat)).includes(currentTerm)) {
          const g = ensure(cuestionarioId, baseDatos, chat);
          if (g) g.hasChat = true;
        }
      });

      imagenes.forEach((img) => {
        const cuestionarioId = img.cuestionarioId || img.trabajoId || img.checklistId || img.id;
        const baseDatos = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(img.datos) };
        if (norm(textoTrabajo(cuestionarioId, baseDatos, img)).includes(currentTerm)) {
          const g = ensure(cuestionarioId, baseDatos, img);
          if (g) g.hasImagenes = true;
        }
      });

      documentos.forEach((docu) => {
        const cuestionarioId = docu.cuestionarioId || docu.trabajoId || docu.checklistId || docu.id;
        const baseDatos = { ...datosObjeto(cqMap.get(cuestionarioId)?.datos), ...datosObjeto(docu.datos) };
        if (norm(textoTrabajo(cuestionarioId, baseDatos, docu)).includes(currentTerm)) {
          const g = ensure(cuestionarioId, baseDatos, docu);
          if (g) g.hasDocumentos = true;
        }
      });

      const final = Array.from(groups.values()).map((g) => ({
        ...g,
        hasCuestionario: g.hasCuestionario || cqMap.has(g.id),
        hasChat: g.hasChat || chatIds.has(g.id),
        fechaOrden: Math.max(g.fechaOrden || 0, fechaItem(cqMap.get(g.id) || {})),
      })).sort((a, b) => (b.fechaOrden || 0) - (a.fechaOrden || 0)).slice(0, 12);

      setResults(final);
    } catch (e) {
      console.error("Error en buscador global:", e);
      setResults([]);
    } finally {
      if (lastSearchRef.current === searchId) setLoading(false);
    }
  };

  useEffect(() => {
    if (!cleanTerm || cleanTerm.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const timer = setTimeout(() => buscar(cleanTerm), 350);
    return () => clearTimeout(timer);
  }, [cleanTerm]);

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
          onFocus={() => { if (results.length > 0 || cleanTerm.length >= 2) setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") buscar(); if (e.key === "Escape") setOpen(false); }}
          placeholder="Buscar matrícula u OR..."
          className="min-w-0 flex-1 px-4 py-2 text-sm outline-none"
        />
        <button onClick={() => buscar()} className="bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700">
          {loading ? "..." : "Buscar"}
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          {loading ? <p className="p-3 text-sm text-slate-500">Buscando coincidencias…</p> : results.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No se han encontrado coincidencias.</p>
          ) : results.map((r) => {
            const d = datosObjeto(r.datos);
            return (
              <div key={r.id} className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3 last:mb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-900">{d.matricula || "Sin matrícula"} — {d.numeroOR || "Sin OR"}</p>
                    <p className="text-xs text-slate-600">{d.nombreCliente || d.nombre || "Sin cliente"} {d.marcaModelo ? `· ${d.marcaModelo}` : ""}</p>
                  </div>
                  {r.estadoPresupuesto ? <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${estadoColor(r.estadoPresupuesto)}`}>{estadoLegible(r.estadoPresupuesto)}</span> : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button onClick={() => abrir(`/cliente-form/${encodeURIComponent(r.id)}?view=true`)} className="rounded-lg bg-indigo-600 px-2 py-2 text-xs font-bold text-white">Cuestionario</button>
                  <button onClick={() => abrir(`/diagnostico-form/${encodeURIComponent(r.checklistId || r.id)}/detalle`)} className="rounded-lg bg-yellow-500 px-2 py-2 text-xs font-bold text-white">Checklist</button>
                  <button onClick={() => abrir(`/recambios-form/${encodeURIComponent(r.recambiosId || r.checklistId || r.id)}/detalle`)} className="rounded-lg bg-blue-800 px-2 py-2 text-xs font-bold text-white">Recambios</button>
                  <button onClick={() => abrir(`/chat-trabajo/${encodeURIComponent(r.id)}`)} className="rounded-lg bg-fuchsia-600 px-2 py-2 text-xs font-bold text-white">Chat</button>
                  {r.hasImagenes ? <button onClick={() => abrir(`/imagenes?buscar=${encodeURIComponent(d.matricula || d.numeroOR || r.id)}`)} className="rounded-lg bg-purple-600 px-2 py-2 text-xs font-bold text-white">Imágenes</button> : null}
                  {r.hasDocumentos ? <button onClick={() => abrir(`/documentos?buscar=${encodeURIComponent(d.matricula || d.numeroOR || r.id)}`)} className="rounded-lg bg-orange-500 px-2 py-2 text-xs font-bold text-white">Documentos</button> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
