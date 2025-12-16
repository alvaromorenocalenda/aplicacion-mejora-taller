// app/recambios-form/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import RecambiosForm from "../RecambiosForm";

// Definición de bloques para mostrar checklist
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

export default function RecambiosFormPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [initialEntries, setInitialEntries] = useState([
    {
      referenciaAnterior: "",
      marcaAnterior: "",
      descripcion: "",
      diagnosticador: "",
      observacionesSup: "",
      referenciaTramitada: "",
      fechaPedido: "",
      proveedor: "",
      transporte: "",
      fechaLlegada: "",
      observacionesInf: "",
      recambista: "",
    },
  ]);
  const [checkData, setCheckData] = useState({});

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    (async () => {
      // Cargar recambios existentes
      const recSnap = await getDoc(doc(db, "recambios", id));
      if (recSnap.exists()) {
        const data = recSnap.data();
        setExisting(data);
        setInitialEntries(data.datos);
      }
      // Cargar checklist asociado
      const chkSnap = await getDoc(doc(db, "checklists", id));
      if (chkSnap.exists()) {
        const d = chkSnap.data().datos || {};
        setCheckData(d);
        try {
          const n = (d.nombreCliente || "").trim();
          document.title = `${d.matricula} - ${d.numeroOR} - ${n} - Recambios`.replace(/\s+-\s+-/g, " - ").trim();
        } catch (e) {}
      }
      setLoading(false);
    })();
  }, [id, router]);

  const handleSave = async (entries) => {
    await setDoc(doc(db, "recambios", id), {
      checklistId: id,
      matricula: checkData.matricula || "",
      numeroOR: checkData.numeroOR || "",
      nombreCliente: checkData.nombreCliente || "",
      datos: entries,
      uidAsesor: auth.currentUser.uid,
      creadoEn: serverTimestamp(),
      estadoPresupuesto: "PENDIENTE_PRESUPUESTO",  // ← aquí lo añades
    });
    router.push("/recambios-form");
  };

  // Mostrar valor o guión
  const show = (key) =>
    checkData[key] === undefined || checkData[key] === ""
      ? "—"
      : checkData[key];

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  return (
    <main className="p-6 w-screen max-w-none space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Añadir/Editar Recambios</h1>
        <button
          onClick={() => router.push("/recambios-form")}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Volver
        </button>
      </div>

      {/* Formulario de Recambios */}
      <section className="bg-white p-6 rounded shadow w-[95vw] max-w-none overflow-visible">
        <h2 className="text-xl font-semibold mb-4">Datos de Recambios</h2>
        <RecambiosForm
          initialEntries={initialEntries}
          onSubmit={handleSave}
        />
      </section>

      {/* Detalle de Checklist */}
      <section className="bg-white p-6 rounded shadow w-[95vw] max-w-none overflow-visible">
        <h2 className="text-2xl font-bold border-b pb-2">Detalle de Checklist</h2>

        {/* Datos Información Vehículo */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: "matricula", label: "Matrícula" },
            { key: "numeroOR", label: "Nº OR" },
            { key: "ciclo", label: "Ciclo" },
            { key: "marcaModelo", label: "Marca/Modelo" },
            { key: "fechaCita", label: "Fecha de cita" },
            { key: "diagnosticador", label: "Diagnosticador" },
            { key: "mensaje", label: "Testigos/Mensajes" },
          ].map(({ key, label }) => (
            <div key={key}>
              <strong className="block text-xs text-gray-700">{label}:</strong>
              <div className="mt-1 text-sm text-gray-800">{show(key)}</div>
            </div>
          ))}
        </div>

        {/* Observaciones (testigos/mensajes) */}
        <div>
          <strong className="block text-xs text-gray-700">
            Observaciones (testigos/mensajes):
          </strong>
          <div className="mt-1 text-sm text-gray-800">
            {show("obs_testigos_mensajes")}
          </div>
        </div>

        {/* Recambios solicitados */}
        <div>
          <h3 className="font-semibold text-lg mb-1">Recambios solicitados</h3>
          <p className="mt-1 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded">
            {show("recambios")}
          </p>
        </div>

        {/* Niveles de líquidos */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Niveles de líquidos</h3>
          <table className="w-full border-2 border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2"></th>
                {['Bien','Regular','Cambio'].map(h => (
                  <th key={h} className="border p-2 text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LIQUID_KEYS.map(({ key, label }) => (
                <tr key={key}>
                  <td className="border p-2">{label}</td>
                  {['bien','regular','cambio'].map(v => (
                    <td key={v} className="border p-2 text-center">
                      {checkData[key] === v ? '✓' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inspección de fugas */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Inspección de fugas</h3>
          <table className="w-full border-2 border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2"></th>
                <th className="border p-2 text-center">Sí</th>
                <th className="border p-2 text-center">No</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">Inspección de fugas</td>
                {['si','no'].map(v => (
                  <td key={v} className="border p-2 text-center">
                    {checkData.inspeccion_fugas === v ? '✓' : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Observaciones líquidos */}
        <div>
          <strong className="block text-xs text-gray-700">Observaciones líquidos:</strong>
          <div className="mt-1 text-sm text-gray-800">
            {show('obs_liquidos')}
          </div>
        </div>

        {/* Otros bloques: neumáticos, frenos, limpiaparabrisas y otros elementos */}
        {OTHER_BLOCKS.map(({ title, keys, obsKey }) => (
          <div key={title}>
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <table className="w-full border-2 border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2"></th>
                  {['Bien','Regular','Cambio'].map(h => (
                    <th key={h} className="border p-2 text-center">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {['bien','regular','cambio'].map(v => (
                      <td key={v} className="border p-2 text-center">
                        {checkData[key] === v ? '✓' : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2">
              <strong className="block text-xs text-gray-700">
                Observaciones {title.toLowerCase()}:
              </strong>
              <div className="mt-1 text-sm text-gray-800">{show(obsKey)}</div>
            </div>
          </div>
        ))}

        {/* Batería */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Batería</h3>
          <p><strong>Estado:</strong> {show('bateria')}</p>
          <div className="mt-2">
            <strong className="block text-xs text-gray-700">Observaciones batería:</strong>
            <div className="mt-1 text-sm text-gray-800">{show('obs_bateria')}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
