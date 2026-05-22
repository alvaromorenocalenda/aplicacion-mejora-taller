// app/recambios-form/[id]/detalle/page.js
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import VehicleImages from "@/components/VehicleImages";

const RECEPCION_ACTIVA_FIELDS = [
  { key: "recepcionKilometraje", label: "Kilometraje" },
  { key: "recepcionNivelCombustible", label: "Nivel de combustible" },
  { key: "recepcionAireAcondicionado", label: "Estado del aire acondicionado (enfría)" },
  { key: "recepcionAlfombrillasEstado", label: "Estado de las alfombrillas" },
  { key: "recepcionAlfombrillasObservaciones", label: "Observaciones alfombrillas", full: true },
  { key: "recepcionNeumaticoDelanteroDerecho", label: "Neumático delantero derecho" },
  { key: "recepcionNeumaticoDelanteroIzquierdo", label: "Neumático delantero izquierdo" },
  { key: "recepcionNeumaticoTraseroDerecho", label: "Neumático trasero derecho" },
  { key: "recepcionNeumaticoTraseroIzquierdo", label: "Neumático trasero izquierdo" },
  { key: "recepcionLimpiabrisasEstado", label: "Estado general de limpiabrisas" },
];

export default function RecambiosDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [estadoRecambios, setEstadoRecambios] = useState("SIN_INICIAR");
  const [datosCuestionario, setDatosCuestionario] = useState({});
  const [checklistIdVehiculo, setChecklistIdVehiculo] = useState("");
  const [cuestionarioIdVehiculo, setCuestionarioIdVehiculo] = useState("");

  useEffect(() => {
    if (!id) return;
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const snap = await getDoc(doc(db, "recambios", id));
        if (!snap.exists()) {
          router.push("/recambios-form");
          return;
        }

        const data = snap.data() || {};
        setEntries(data.datos || []);
        setEstadoRecambios(data.estadoRecambios || "SIN_INICIAR");

        // El documento de recambios normalmente usa como ID el checklistId.
        // Desde el checklist obtenemos el cuestionarioId para poder mostrar la recepción activa.
        const checklistId = data.checklistId || id;
        setChecklistIdVehiculo(checklistId);
        const checklistSnap = await getDoc(doc(db, "checklists", checklistId));
        const checklistData = checklistSnap.exists() ? checklistSnap.data() || {} : {};
        const cuestionarioId = checklistData.cuestionarioId || data.cuestionarioId || id;
        setCuestionarioIdVehiculo(cuestionarioId);

        if (cuestionarioId) {
          const cuestionarioSnap = await getDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
          if (cuestionarioSnap.exists()) {
            const cuestionarioData = cuestionarioSnap.data() || {};
            setDatosCuestionario(cuestionarioData.datos || {});
          }
        }
      } catch (error) {
        console.error("Error cargando detalle de recambios:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando recambios…</p>;

  const show = (key) => {
    const v = datosCuestionario[key];
    if (v === undefined || v === null) return "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    if (typeof v === "string") return v.trim() === "" ? "—" : v;
    return String(v);
  };

  return (
    <div className="p-6 bg-[#FAF9F6] min-h-screen">
      <button
        onClick={() => router.push("/recambios-form")}
        className="mb-4 px-4 py-2 bg-[#A8DADC] text-[#1F433D] rounded hover:bg-[#81C5B6]"
      >
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

      <section className="mb-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-5 shadow-sm">
        <h2 className="text-xl font-bold text-blue-900">Recepción activa del vehículo</h2>
        <p className="text-xs text-blue-700 mb-4">
          Datos rellenados por el asesor en el cuestionario de cliente.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RECEPCION_ACTIVA_FIELDS.map(({ key, label, full }) => (
            <div key={key} className={full ? "md:col-span-2" : ""}>
              <strong className="block text-xs text-gray-700">{label}:</strong>
              <div className="mt-1 text-sm text-gray-800">{show(key)}</div>
            </div>
          ))}
        </div>
      </section>

      <VehicleImages
        checklistId={checklistIdVehiculo || id}
        cuestionarioId={cuestionarioIdVehiculo}
        matricula={datosCuestionario.matricula}
        numeroOR={datosCuestionario.numeroOR}
        compact
      />

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse rounded shadow text-sm">
          <thead>
            <tr className="bg-blue-200 text-gray-900 font-semibold">
              <th className="px-4 py-2">Letra</th>
              <th className="px-4 py-2">Referencia anterior</th>
              <th className="px-4 py-2">Unidades (ant.)</th>
              <th className="px-4 py-2">Marca anterior</th>
              <th className="px-4 py-2">Descripción</th>
              <th className="px-4 py-2">Diagnosticador</th>
              <th className="px-4 py-2 border-r-4 border-white">Observaciones</th>
              <th className="px-4 py-2">Referencia tramitada</th>
              <th className="px-4 py-2">Unidades (tram.)</th>
              <th className="px-4 py-2">Fecha pedido</th>
              <th className="px-4 py-2 w-[180px] min-w-[160px]">Proveedor</th>
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
                <td className="px-4 py-2">{e.unidadesAnterior ?? "—"}</td>
                <td className="px-4 py-2">{e.marcaAnterior || "—"}</td>
                <td className="px-4 py-2">{e.descripcion || "—"}</td>
                <td className="px-4 py-2">{e.diagnosticador || "—"}</td>
                <td className="px-4 py-2 border-r-4 border-white">
                  {e.observacionesSup || "—"}
                </td>
                <td className="px-4 py-2">{e.referenciaTramitada || "—"}</td>
                <td className="px-4 py-2">{e.unidadesTramitadas ?? "—"}</td>
                <td className="px-4 py-2">{e.fechaPedido || "—"}</td>
                <td className="px-4 py-2 w-[180px] min-w-[160px]">{e.proveedor || "—"}</td>
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
