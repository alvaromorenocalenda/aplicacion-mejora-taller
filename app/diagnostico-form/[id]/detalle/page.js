// app/diagnostico-form/[id]/detalle/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// Define aquí tus bloques
const LIQUID_KEYS = [
  { key: "aceite", label: "Aceite motor" },
  { key: "refrigerante", label: "Refrigerante" },
  { key: "freno_liquido", label: "Freno líquido" },
  { key: "embrague_liquido", label: "Embrague líquido" },
  { key: "servo_liquido", label: "Servodirección hidráulica" },
  { key: "limpiap_liquido", label: "Limpiaparabrisas" },
];
const OTHER_BLOCKS = [
  {
    title: "Neumáticos",
    keys: [
      { key: "neuma_di", label: "DI (Delantero Izq.)" },
      { key: "neuma_dd", label: "DD (Delantero Der.)" },
      { key: "neuma_ti", label: "TI (Trasero Izq.)" },
      { key: "neuma_td", label: "TD (Trasero Der.)" },
    ],
    obsKey: "obs_neumaticos",
  },
  {
    title: "Frenos",
    keys: [
      { key: "frenos_discos", label: "Discos" },
      { key: "frenos_pastillas", label: "Pastillas" },
      { key: "frenos_racores", label: "Racores flexibles" },
      { key: "freno_est", label: "Freno de estacionamiento" },
    ],
    obsKey: "obs_frenos",
  },
  {
    title: "Limpiaparabrisas",
    keys: [
      { key: "limpia_func", label: "Funcionamiento" },
      { key: "limpia_escobillas_di", label: "Escobillas DI" },
      { key: "limpia_escobillas_dd", label: "Escobillas DD" },
      { key: "limpia_escobillas_trasera", label: "Escobillas trasera" },
      { key: "limpia_surt_di", label: "Surtidor DI" },
      { key: "limpia_surt_dd", label: "Surtidor DD" },
      { key: "limpia_surt_tr", label: "Surtidor trasero" },
    ],
    obsKey: "obs_limpiaparabrisas",
  },
  {
    title: "Otros elementos",
    keys: [
      { key: "otros_rotulas", label: "Guardapolvos de rótulas" },
      { key: "otros_fuelles", label: "Fuelles de transmisión" },
      { key: "otros_amort", label: "Amortiguadores" },
      { key: "otros_escape", label: "Línea de escape" },
      { key: "otros_tanque", label: "Tanque de combustible" },
      { key: "otros_cubre", label: "Cubre bajos" },
    ],
    obsKey: "obs_otros",
  },
];

export default function ChecklistDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({});

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    (async () => {
      const snap = await getDoc(doc(db, "checklists", id));
      if (!snap.exists()) {
        router.replace("/diagnostico-form");
        return;
      }
      setData(snap.data().datos || {});
      setLoading(false);
    })();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  // helper para mostrar guión si no hay valor
  const show = (key) =>
    data[key] === undefined || data[key] === "" ? "—" : data[key];
    
return (
  <main className="p-6 max-w-screen-xl mx-auto">
    {/* 1) HEADER */}
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold">Detalle Checklist</h1>
      <button
        onClick={() => router.push("/diagnostico-form")}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        Volver
      </button>
    </div>

    {/* 2) GRID DE DOS COLUMNAS */}
    <div className="grid grid-cols-2 items-start gap-6">
      {/* --- COLUMNA IZQUIERDA --- */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded shadow space-y-6">
          {/* Aquí va TODO tu contenido (Datos Vehículo, Puntos de revisión, etc) */}
                {/* CUADRO CLIENTE */}
        <section>
          <h2 className="text-xl font-semibold mb-4">
            Datos Información Vehículo
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "matricula", label: "Matrícula" },
              { key: "numeroOR", label: "Nº OR" },
              { key: "ciclo", label: "Ciclo" },
              { key: "marcaModelo", label: "Marca/Modelo" },
              { key: "fechaCita", label: "Fecha de cita", type: "date" },
              { key: "diagnosticador", label: "Diagnosticador" },
              { key: "mensaje", label: "Testigos/Mensajes" },
              
            ].map(({ key, label }) => (
              <div key={key}>
                <strong className="block text-xs text-gray-700">{label}:</strong>
                <div className="mt-1 text-sm text-gray-800">{show(key)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Observaciones (testigos/mensajes) */}
        <div className="mt-4">
            <strong className="block text-xs text-gray-700">
              Observaciones (testigos/mensajes):
            </strong>
          <div className="mt-1 text-sm text-gray-800">
              {show("obs_testigos_mensajes")}
          </div>
        </div>

        {/* RECAMBIOS */}
        <section>
          <h3 className="font-semibold text-lg">Recambios solicitados</h3>
          <p className="mt-2 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded">
            {show("recambios")}
          </p>
        </section>

        {/* PUNTOS DE REVISIÓN */}
        <section>
          <h2 className="text-xl font-bold border-b-2 border-red-600 pb-1">
            Puntos de revisión
          </h2>

          {/* Líquidos + Fugas */}
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Niveles de líquidos</h3>
            <table className="w-full border-2 border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left"></th>
                  {["Bien", "Regular", "Cambio"].map((h) => (
                    <th key={h} className="border p-2 text-center">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {LIQUID_KEYS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        {data[key] === v ? "✓" : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Inspección de fugas */}
            <div className="mt-4">
              <h3 className="font-semibold mb-2">Inspección de fugas</h3>
              <table className="w-full border-2 border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left"></th>
                    <th className="border p-2 text-center">Sí</th>
                    <th className="border p-2 text-center">No</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border p-2">Inspección de fugas</td>
                    {["si", "no"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        {data.inspeccion_fugas === v ? "✓" : ""}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Observaciones líquidos */}
            <div className="mt-4">
              <strong>Observaciones líquidos:</strong>
              <p className="mt-1">{show("obs_liquidos")}</p>
            </div>
          </div>

          {/* Bloques restantes */}
          {OTHER_BLOCKS.map(({ title, keys, obsKey }) => (
            <div key={title} className="mt-8">
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <table className="w-full border-2 border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border p-2 text-left"></th>
                    {["Bien", "Regular", "Cambio"].map((h) => (
                      <th key={h} className="border p-2 text-center">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keys.map(({ key, label }) => (
                    <tr key={key}>
                      <td className="border p-2">{label}</td>
                      {["bien", "regular", "cambio"].map((v) => (
                        <td key={v} className="border p-2 text-center">
                          {data[key] === v ? "✓" : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Observaciones del bloque */}
              <div className="mt-2">
                <strong>Observaciones {title.toLowerCase()}:</strong>
                <p className="mt-1">{show(obsKey)}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Batería */}
        <section className="mt-8">
          <h3 className="font-semibold text-lg">Batería</h3>
          <p className="mt-2">
            <strong>Estado:</strong> {show("bateria")}
          </p>
          <div className="mt-4">
            <strong>Observaciones batería:</strong>
            <p className="mt-1">{show("obs_bateria")}</p>
          </div>
        </section>
          
        </div>
      </div>
      {/* *** IMPORTANTE: Ambos divs anteriores ya están cerrados aquí *** */}

      {/* --- COLUMNA DERECHA --- */}
      <div className="bg-white p-6 rounded shadow overflow-auto h-[100vh]">
        <iframe
          src="/checklist_formulario.pdf#toolbar=1&zoom=page-width"
          title="Checklist PDF"
          className="w-full h-full border-2 border-gray-300"
        />
      </div>
    </div>
  </main>
);
}