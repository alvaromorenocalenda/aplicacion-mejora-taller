// app/recambios-form/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import RecambiosForm from "../RecambiosForm";
import VehicleImages from "@/components/VehicleImages";

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

// En recambios, Bombillas es un bloque especial (Bien/Mal) que debe ir
// entre Limpiaparabrisas y Otros elementos.
const OTHER_BLOCKS_BEFORE_BOMBILLAS = OTHER_BLOCKS.filter(
  (b) => b.title !== "Otros elementos"
);
const OTHER_BLOCKS_AFTER_BOMBILLAS = OTHER_BLOCKS.filter(
  (b) => b.title === "Otros elementos"
);

const RECEPCION_ACTIVA_KEYS = [
  { key: "recepcionKilometraje", label: "Kilometraje" },
  { key: "recepcionNivelCombustible", label: "Nivel de combustible" },
  { key: "recepcionAireAcondicionado", label: "Aire acondicionado enfría" },
  { key: "recepcionAlfombrillasEstado", label: "Estado alfombrillas" },
  { key: "recepcionAlfombrillasObservaciones", label: "Observaciones alfombrillas" },
  { key: "recepcionNeumaticoDelanteroDerecho", label: "Neumático delantero derecho" },
  { key: "recepcionNeumaticoDelanteroIzquierdo", label: "Neumático delantero izquierdo" },
  { key: "recepcionNeumaticoTraseroDerecho", label: "Neumático trasero derecho" },
  { key: "recepcionNeumaticoTraseroIzquierdo", label: "Neumático trasero izquierdo" },
  { key: "recepcionLimpiabrisasEstado", label: "Estado general de limpiabrisas" },
];


export default function RecambiosFormPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id);
const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState(null);
  const [estadoRecambios, setEstadoRecambios] = useState("SIN_INICIAR");
  const [initialEntries, setInitialEntries] = useState([
    {
      referenciaAnterior: "",
      unidadesAnterior: "",
      marcaAnterior: "",
      descripcion: "",
      diagnosticador: "",
      observacionesSup: "",
      referenciaTramitada: "",
      unidadesTramitadas: "",
      fechaPedido: "",
      proveedor: "",
      transporte: "",
      fechaPrevista: "",
      fechaLlegada: "",
      observacionesInf: "",
      recambista: "",
    },
  ]);
  const [checkData, setCheckData] = useState({});
  const [cuestionarioId, setCuestionarioId] = useState("");

  const needsChecklistReview =
    !!existing?.checklistEditada && !existing?.checklistEditadaRevisada;

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
        setEstadoRecambios(data.estadoRecambios || "SIN_INICIAR");
      } else {
        // Si aún no existe el documento de recambios, empezamos en "Sin iniciar"
        setEstadoRecambios("SIN_INICIAR");
      }
      // Cargar checklist asociado
      const chkSnap = await getDoc(doc(db, "checklists", id));
      if (chkSnap.exists()) {
        const chk = chkSnap.data() || {};
        const d = chk.datos || {};

        // ✅ Fuente de verdad para matrícula / OR / nombre: cuestionarios_cliente
        // (así, si se edita el cuestionario, aquí también se refleja)
        let datosCuestionario = {};
        if (chk.cuestionarioId) {
          setCuestionarioId(chk.cuestionarioId);
          const cuestSnap = await getDoc(doc(db, "cuestionarios_cliente", chk.cuestionarioId));
          if (cuestSnap.exists()) {
            datosCuestionario = (cuestSnap.data() || {}).datos || {};
          }
        }

        // Mezclamos los datos del cuestionario de cliente con los datos del checklist.
        // La recepción activa se guarda en cuestionarios_cliente.datos, no en checklists.datos.
        // Por eso, si aquí solo usamos d, en Recambios aparece todo con guiones.
        const merged = {
          ...datosCuestionario,
          ...d,
          ...(datosCuestionario.matricula !== undefined
            ? { matricula: datosCuestionario.matricula }
            : {}),
          ...(datosCuestionario.numeroOR !== undefined
            ? { numeroOR: datosCuestionario.numeroOR }
            : {}),
          ...(datosCuestionario.nombreCliente !== undefined
            ? { nombreCliente: datosCuestionario.nombreCliente }
            : {}),
        };

        setCheckData(merged);

        try {
          const n = (merged.nombreCliente || "").trim();
          document.title = `${merged.matricula} - ${merged.numeroOR} - ${n} - Recambios`
            .replace(/\s+-\s+-/g, " - ")
            .trim();
        } catch (e) {}

        // ✅ Si ya existe recambios, sincronizamos SOLO cabecera (sin tocar la tabla de recambios)
        // para que quede actualizada en BD.
        try {
          if (recSnap.exists()) {
            const recData = recSnap.data() || {};
            const changed =
              (recData.matricula || "") !== (merged.matricula || "") ||
              (recData.numeroOR || "") !== (merged.numeroOR || "") ||
              (recData.nombreCliente || "") !== (merged.nombreCliente || "");

            if (changed) {
              await updateDoc(doc(db, "recambios", id), {
                matricula: merged.matricula || "",
                numeroOR: merged.numeroOR || "",
                nombreCliente: merged.nombreCliente || "",
              });
            }
          }
        } catch (e) {
          // No bloqueamos la pantalla si esto falla
          console.log("No se pudo sincronizar cabecera de recambios:", e);
        }
      }
      setLoading(false);
    })();
  }, [id, router]);

  const handleSave = async (entries) => {
    const payload = {
      checklistId: id,
      matricula: checkData.matricula || "",
      numeroOR: checkData.numeroOR || "",
      nombreCliente: checkData.nombreCliente || "",
      datos: entries,
      estadoRecambios,
      uidAsesor: auth.currentUser.uid,
      estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
      actualizadoEn: serverTimestamp(),
    };
    // Solo ponemos creadoEn la primera vez
    if (!existing?.creadoEn) payload.creadoEn = serverTimestamp();

    await setDoc(doc(db, "recambios", id), payload, { merge: true });
    router.push("/recambios-form");
  };

  const handleMarcarRevisado = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "recambios", id), {
        checklistEditadaRevisada: true,
        checklistEditadaRevisadaAt: serverTimestamp(),
        checklistEditadaRevisadaBy: auth.currentUser.uid,
      });

      setExisting((prev) => ({ ...(prev || {}), checklistEditadaRevisada: true }));
    } catch (err) {
      console.error("Error al marcar revisado:", err);
      alert("No se pudo marcar como revisado: " + (err?.message || err));
    }
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

      {needsChecklistReview && (
        <section className="bg-yellow-100 border border-yellow-400 rounded p-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="font-semibold text-yellow-900">
            ⚠️ CHECKLIST MODIFICADA, COMPROBAR SI HAY QUE MODIFICAR RECAMBIOS.
          </div>
          <button
            onClick={handleMarcarRevisado}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            title="Oculta el aviso hasta que se vuelva a editar la checklist"
          >
            Marcar revisado
          </button>
        </section>
      )}

      {/* Imágenes del vehículo */}
      <VehicleImages
        checklistId={id}
        cuestionarioId={cuestionarioId}
        matricula={checkData.matricula}
        numeroOR={checkData.numeroOR}
        compact
      />

      {/* Formulario de Recambios */}
      <section className="bg-white p-6 rounded shadow w-[95vw] max-w-none overflow-visible">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-semibold">Datos de Recambios</h2>
        </div>
        <RecambiosForm
          initialEntries={initialEntries}
          onSubmit={handleSave}
          estadoRecambios={estadoRecambios}
          onEstadoChange={setEstadoRecambios}
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

        {/* Recepción activa del vehículo */}
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-900">
            Recepción activa del vehículo
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {RECEPCION_ACTIVA_KEYS.map(({ key, label }) => (
              <div key={key}>
                <strong className="block text-xs text-gray-700">{label}:</strong>
                <div className="mt-1 text-sm text-gray-800">{show(key)}</div>
              </div>
            ))}
          </div>
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

        {/* Otros bloques: neumáticos, frenos y limpiaparabrisas */}
        {OTHER_BLOCKS_BEFORE_BOMBILLAS.map(({ title, keys, obsKey }) => (
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

        {/* Bombillas (Bien / Mal) */}
        <div>
          <h3 className="font-semibold text-lg mb-2">Bombillas</h3>
          <table className="w-full border-2 border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-2"></th>
                {['Bien','Mal'].map(h => (
                  <th key={h} className="border p-2 text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-2">Estado general de bombillas</td>
                {['bien','mal'].map(v => (
                  <td key={v} className="border p-2 text-center">
                    {checkData.bombillas_estado === v ? '✓' : ''}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <div className="mt-2">
            <strong className="block text-xs text-gray-700">
              Observaciones bombillas:
            </strong>
            <div className="mt-1 text-sm text-gray-800">{show('obs_bombillas')}</div>
          </div>
        </div>

        {/* Otros elementos */}
        {OTHER_BLOCKS_AFTER_BOMBILLAS.map(({ title, keys, obsKey }) => (
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
