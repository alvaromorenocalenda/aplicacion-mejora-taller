// app/diagnostico-form/[id]/detalle/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db, storage } from "../../../../lib/firebase";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, listAll, ref } from "firebase/storage";


function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function uniqueImages(images) {
  const seen = new Set();
  return images.filter((img) => {
    const key = img.rutaStorage || img.name || img.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buscarImagenesVehiculo({ checklistId, matricula, numeroOR }) {
  const matNorm = normalizeText(matricula);
  const orNorm = normalizeText(numeroOR);
  const resultados = [];

  // 1) Búsqueda nueva y más fiable: documentos guardados en Firestore al subir las fotos.
  try {
    const qChecklist = query(
      collection(db, "imagenes_vehiculo"),
      where("checklistId", "==", checklistId)
    );
    const snapChecklist = await getDocs(qChecklist);
    snapChecklist.forEach((docSnap) => {
      const img = docSnap.data() || {};
      if (img.url) resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
    });
  } catch (error) {
    console.error("Error buscando imágenes por checklistId:", error);
  }

  try {
    if (matNorm && orNorm) {
      const qMatricula = query(
        collection(db, "imagenes_vehiculo"),
        where("matriculaNormalizada", "==", matNorm)
      );
      const snapMatricula = await getDocs(qMatricula);
      snapMatricula.forEach((docSnap) => {
        const img = docSnap.data() || {};
        if (normalizeText(img.numeroORNormalizado || img.numeroOR) === orNorm && img.url) {
          resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
        }
      });
    }
  } catch (error) {
    console.error("Error buscando imágenes por matrícula y nº OR:", error);
  }

  // 2) Búsqueda compatible con fotos antiguas: mira nombres en Storage aunque tengan espacios, guiones, paréntesis, etc.
  try {
    if (matNorm && orNorm) {
      const listRef = ref(storage, "imagenes/");
      const res = await listAll(listRef);
      const antiguas = await Promise.all(
        res.items.map(async (itemRef) => {
          const nombreNormalizado = normalizeText(itemRef.name);
          const coincide = nombreNormalizado.includes(matNorm) && nombreNormalizado.includes(orNorm);
          if (!coincide) return null;

          return {
            url: await getDownloadURL(itemRef),
            name: itemRef.name,
            nombreArchivo: itemRef.name,
            rutaStorage: itemRef.fullPath,
          };
        })
      );

      resultados.push(...antiguas.filter(Boolean));
    }
  } catch (error) {
    console.error("Error buscando imágenes antiguas en Storage:", error);
  }

  return uniqueImages(resultados);
}

// Define aquí tus bloques
const LIQUID_KEYS = [
  { key: "aceite", label: "Aceite motor" },
  { key: "refrigerante", label: "Refrigerante" },
  { key: "freno_liquido", label: "Freno líquido" },
  { key: "embrague_liquido", label: "Embrague líquido" },
  { key: "servo_liquido", label: "Servodirección hidráulica" },
  { key: "limpiap_liquido", label: "Limpiaparabrisas" },
];

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
    title: "Bombillas",
    type: "bien_mal",
    keys: [
      { key: "bombillas_estado", label: "Estado general de bombillas" },
    ],
    obsKey: "obs_bombillas",
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
  const params = useParams();
  // En algunas cargas iniciales `params.id` puede venir undefined (Next.js client navigation)
  // y `decodeURIComponent(undefined)` rompe la página.
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // datos del diagnóstico (checklists)
  const [dataDiag, setDataDiag] = useState({});
  // datos del cuestionario (cuestionarios_cliente)
  const [dataCuest, setDataCuest] = useState({});
  const [imagenesVehiculo, setImagenesVehiculo] = useState([]);
  const [loadingImagenes, setLoadingImagenes] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const snapChecklist = await getDoc(doc(db, "checklists", id));
        if (!snapChecklist.exists()) {
          router.replace("/diagnostico-form");
          return;
        }

        const checklistDoc = snapChecklist.data() || {};
        const diagDatos = checklistDoc.datos || {};
        let cuestDatos = {};
        setDataDiag(diagDatos);

        // 🔥 aquí está la clave: leer también el cuestionario
        const cuestionarioId = checklistDoc.cuestionarioId;
        if (cuestionarioId) {
          const snapCuest = await getDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
          if (snapCuest.exists()) {
            const cuestDoc = snapCuest.data() || {};
            cuestDatos = cuestDoc.datos || {};
            setDataCuest(cuestDatos);
          }
        }

        const datosCombinados = { ...cuestDatos, ...diagDatos };
        setLoadingImagenes(true);
        const fotos = await buscarImagenesVehiculo({
          checklistId: id,
          matricula: datosCombinados.matricula,
          numeroOR: datosCombinados.numeroOR,
        });
        setImagenesVehiculo(fotos);
        setLoadingImagenes(false);

        setLoading(false);
      } catch (e) {
        console.error("Error cargando detalle diagnóstico:", e);
        setLoadingImagenes(false);
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  // merge: prioridad a diagnóstico, si falta -> cuestionario
  const data = { ...dataCuest, ...dataDiag };

  // helper para mostrar guión si no hay valor
  const show = (key) => {
    const v = data[key];
    if (v === undefined || v === null) return "—";
    if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
    if (typeof v === "string") return v.trim() === "" ? "—" : v;
    return String(v);
  };

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
            {/* CUADRO CLIENTE */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Datos Información Vehículo</h2>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: "matricula", label: "Matrícula" },
                  { key: "nombreCliente", label: "Nombre" },
                  { key: "telefonoCliente", label: "Teléfono Cliente" },
                  { key: "numeroOR", label: "Nº OR" },
                  { key: "ciclo", label: "Ciclo" },
                  { key: "marcaModelo", label: "Marca/Modelo" },
                  { key: "fechaCita", label: "Fecha de cita" },
                  { key: "fechaSalida", label: "Fecha salida" },
                  { key: "asesor", label: "Asesor" },
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
              <div className="mt-1 text-sm text-gray-800">{show("obs_testigos_mensajes")}</div>
            </div>


            {/* RECEPCIÓN ACTIVA DEL VEHÍCULO */}
            <section className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg text-blue-900">Recepción activa del vehículo</h3>
              <p className="text-xs text-blue-700 mb-4">Datos rellenados por el asesor en la recepción del vehículo.</p>
              <div className="grid grid-cols-2 gap-4">
                {RECEPCION_ACTIVA_FIELDS.map(({ key, label, full }) => (
                  <div key={key} className={full ? "col-span-2" : ""}>
                    <strong className="block text-xs text-gray-700">{label}:</strong>
                    <div className="mt-1 text-sm text-gray-800">{show(key)}</div>
                  </div>
                ))}
              </div>
            </section>


            {/* IMÁGENES DEL VEHÍCULO */}
            <section className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
              <h3 className="font-semibold text-lg text-red-900 mb-4">Imágenes del vehículo</h3>
              {!loadingImagenes && imagenesVehiculo.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {imagenesVehiculo.map((img, idx) => (
                    <div key={`${img.rutaStorage || img.name || img.url}-${idx}`} className="bg-white rounded-lg shadow p-3">
                      <img
                        src={img.url}
                        alt={img.name || "Imagen del vehículo"}
                        className="w-full h-48 object-contain rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => window.open(img.url, "_blank")}
                        className="mt-2 w-full px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                      >
                        Ver imagen
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* RECAMBIOS */}
            <section>
              <h3 className="font-semibold text-lg">Recambios solicitados</h3>
              <p className="mt-2 p-4 bg-yellow-100 border-l-4 border-yellow-500 rounded">
                {show("recambios")}
              </p>
            </section>

            {/* ASESORES */}
            <section className="mt-4">
              <h3 className="font-semibold text-lg">Asesores</h3>
              <p className="mt-2 p-4 bg-green-100 border-l-4 border-green-600 rounded">
                {show("asesores")}
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
                      {/* En líquidos SIEMPRE usamos Bien/Regular/Cambio (no depende de bloques) */}
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
              {OTHER_BLOCKS.map(({ title, type, keys, obsKey }) => (
                <div key={title} className="mt-8">
                  <h3 className="font-semibold text-lg mb-2">{title}</h3>
                  <table className="w-full border-2 border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2 text-left"></th>
                        {type === "bien_mal"
                          ? ["Bien", "Mal"].map((h) => (
                              <th key={h} className="border p-2 text-center">
                                {h}
                              </th>
                            ))
                          : ["Bien", "Regular", "Cambio"].map((h) => (
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
                          {(type === "bien_mal" ? ["bien", "mal"] : ["bien", "regular", "cambio"]).map(
                            (v) => (
                              <td key={v} className="border p-2 text-center">
                                {data[key] === v ? "✓" : ""}
                              </td>
                            )
                          )}
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
