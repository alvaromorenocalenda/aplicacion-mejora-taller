// app/recambios-form/[id]/detalle/page.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function RecambiosDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [estadoRecambios, setEstadoRecambios] = useState("SIN_INICIAR");

  useEffect(() => {
    if (!auth.currentUser) { router.replace("/login"); return; }
    (async () => {
      const snap = await getDoc(doc(db, "recambios", id));
      if (!snap.exists()) router.push("/recambios-form");
      else {
        const data = snap.data();
        setEntries(data.datos || []);
        setEstadoRecambios(data.estadoRecambios || "SIN_INICIAR");
      }
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando recambios…</p>;

  const getLetter = idx => String.fromCharCode(65 + idx);

return (
  <div className="p-6 bg-[#FAF9F6] min-h-screen">
    <button
      onClick={() => router.push("/recambios-form")}
      className="mb-4 px-4 py-2 bg-[#A8DADC] text-[#1F433D] rounded hover:bg-[#81C5B6]">
      ← Volver / Lista
    </button>

    <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
      <h1 className="text-3xl font-bold">Recambios para checklist {id}</h1>
      <span
        className={`px-3 py-1 rounded text-sm font-semibold ${
          estadoRecambios === "FINALIZADO"
            ? "bg-green-400 text-green-900"
            : estadoRecambios === "EN_PROCESO"
              ? "bg-yellow-300 text-yellow-900"
              : "bg-gray-300 text-gray-800"
        }`}
      >
        {estadoRecambios === "FINALIZADO"
          ? "Finalizado"
          : estadoRecambios === "EN_PROCESO"
            ? "En proceso"
            : "Sin iniciar"}
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse rounded shadow text-sm">
        <thead>
          <tr className="bg-blue-200 text-gray-900 font-semibold">
            <th className="px-4 py-2">Letra</th>
            <th className="px-4 py-2">Referencia anterior</th>
            <th className="px-4 py-2">Marca anterior</th>
            <th className="px-4 py-2">Descripción</th>
            <th className="px-4 py-2">Diagnosticador</th>
            <th className="px-4 py-2 border-r-4 border-white">Observaciones</th>
            <th className="px-4 py-2">Referencia tramitada</th>
            <th className="px-4 py-2">Fecha pedido</th>
            <th className="px-4 py-2">Proveedor</th>
            <th className="px-4 py-2">Transporte</th>
            <th className="px-4 py-2">Fecha prevista</th>
            <th className="px-4 py-2">Fecha llegada</th>
            <th className="px-4 py-2">Observaciones</th>
            <th className="px-4 py-2">Recambista</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, idx) => (
            <tr
              key={idx}
              className={idx % 2 === 0 ? "bg-blue-50" : "bg-gray-100"}
            >
              <td className="px-4 py-2">{String.fromCharCode(65 + idx)}</td>
              <td className="px-4 py-2">{e.referenciaAnterior || "—"}</td>
              <td className="px-4 py-2">{e.marcaAnterior || "—"}</td>
              <td className="px-4 py-2">{e.descripcion || "—"}</td>
              <td className="px-4 py-2">{e.diagnosticador || "—"}</td>
              <td className="px-4 py-2 border-r-4 border-white">
                {e.observacionesSup || "—"}
              </td>
              <td className="px-4 py-2">{e.referenciaTramitada || "—"}</td>
              <td className="px-4 py-2">{e.fechaPedido || "—"}</td>
              <td className="px-4 py-2">{e.proveedor || "—"}</td>
              <td className="px-4 py-2">{e.transporte || "—"}</td>
              <td className="px-4 py-2">{e.fechaPrevista || "—"}</td>
              <td className="px-4 py-2">{e.fechaLlegada || "—"}</td>
              <td className="px-4 py-2">{e.observacionesInf || "—"}</td>
              <td className="px-4 py-2">{e.recambista || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
}
