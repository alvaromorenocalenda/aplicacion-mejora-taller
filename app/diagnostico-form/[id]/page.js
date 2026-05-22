// app/diagnostico-form/[id]/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db, storage } from "../../../lib/firebase";
import { fetchMecanicos } from "../../../lib/userProfile";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, listAll, ref } from "firebase/storage";

// Componentes reutilizados
function Field({ label, value }) {
  return (
    <div>
      <strong className="block text-xs text-gray-700">{label}:</strong>
      <div className="mt-1 text-sm text-gray-800">{value}</div>
    </div>
  );
}
function Section({ title, children }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      {children}
    </div>
  );
}
function asList(val) {
  if (Array.isArray(val)) return val.length ? val.join(", ") : "—";
  if (typeof val === "string") return val.trim() ? val : "—";
  if (val === null || val === undefined) return "—";
  return String(val);
}


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

  // 1) Fotos nuevas registradas en Firestore.
  try {
    if (checklistId) {
      const qChecklist = query(
        collection(db, "imagenes_vehiculo"),
        where("checklistId", "==", checklistId)
      );
      const snapChecklist = await getDocs(qChecklist);
      snapChecklist.forEach((docSnap) => {
        const img = docSnap.data() || {};
        if (img.url) resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
      });
    }
  } catch (error) {
    console.error("Error buscando imágenes por checklistId:", error);
  }

  // 2) Fotos nuevas registradas con matrícula + OR normalizados.
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

  // 3) Fotos antiguas: búsqueda flexible directamente en Storage/imagenes.
  // Ejemplo real: AV201PJ + 605 encuentra AV-201-PJ-605.jpg y AV-201-PJ-605 (2).jpg
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

// Lee todos los campos del formulario
function readChecklistData() {
  const fm = new FormData(document.getElementById("diagnosticoForm"));
  const out = {};
  for (const [k, v] of fm.entries()) {
    if (out[k] === undefined) out[k] = v;
    else if (Array.isArray(out[k])) out[k].push(v);
    else out[k] = [out[k], v];
  }
  return out;
}

export default function DiagnosticoFormPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id);
const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [cuestionario, setCuestionario] = useState({});
  const [imagenesVehiculo, setImagenesVehiculo] = useState([]);
  const [loadingImagenes, setLoadingImagenes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // Lista de mecánicos para desplegable de "Diagnosticador"
  const [mecanicos, setMecanicos] = useState([]);
  const [diagnosticador, setDiagnosticador] = useState("");

  useEffect(() => {
    fetchMecanicos()
      .then(setMecanicos)
      .catch(() => setMecanicos([]));
  }, []);

  // Cargo el cuestionario cliente
  useEffect(() => {
    if (!auth.currentUser) return router.replace("/login");

    (async () => {
      const cuestionarioSnap = await getDoc(doc(db, "cuestionarios_cliente", id));
      if (!cuestionarioSnap.exists()) return router.replace("/diagnostico-form");

      const cuestionarioData = cuestionarioSnap.data().datos;

      // 🔍 Buscar si ya existe un checklist
      const checklistId = `${cuestionarioData.matricula}-${cuestionarioData.numeroOR}`;
      const checklistSnap = await getDoc(doc(db, "checklists", checklistId));
      const checklistData = checklistSnap.exists() ? checklistSnap.data().datos : {};

      // ⏫ Unificar datos para el formulario
      const datosCombinados = {
        ...cuestionarioData,
        ...checklistData
      };

      setCuestionario(datosCombinados);

      // Buscar imágenes del vehículo también en esta pantalla de diagnóstico (/diagnostico-form/[id])
      setLoadingImagenes(true);
      const fotos = await buscarImagenesVehiculo({
        checklistId,
        matricula: datosCombinados.matricula,
        numeroOR: datosCombinados.numeroOR,
      });
      setImagenesVehiculo(fotos);
      setLoadingImagenes(false);

      // Si ya venía guardado, lo mantenemos; si no, lo dejamos vacío.
      setDiagnosticador(datosCombinados.diagnosticador || "");
      try {
        const n = datosCombinados.nombreCliente || "";
        document.title = `${datosCombinados.matricula} - ${datosCombinados.numeroOR} - ${n} - Diagnostico`
          .replace(/\s+-\s+-/g, " - ")
          .trim();
      } catch (e) {}
      setLoading(false);
    })();
  }, [id, router]);

  // Guarda la checklist con ID “matricula-numeroOR”
  async function handleSave(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      const datosChecklist = readChecklistData();
      const customId = `${cuestionario.matricula}-${cuestionario.numeroOR}`;

      await setDoc(
        doc(db, "checklists", customId),
        {
          uidAsesor: auth.currentUser.uid,
          cuestionarioId: id,
          completadoEn: serverTimestamp(),
          datos: datosChecklist,
          estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
        }
      );

      // ✅ Marcar checklist como editada en la colección de recambios
      try {
        await updateDoc(doc(db, "recambios", customId), {
          checklistEditada: true
        });
      } catch (e) {
        console.log("No se pudo marcar la checklist como editada.");
      }

      router.push("/diagnostico-form");
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  if (loading) return <p className="p-6 text-center">Cargando…</p>;

  return (
    <main className="p-6 max-w-7xl mx-auto space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Checklist Diagnóstico</h1>
        <button
          onClick={() => router.push("/diagnostico-form")}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Volver
        </button>
      </div>

      {/* DETALLE CUESTIONARIO CLIENTE */}
      <section className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-semibold mb-4">
          Detalle Cuestionario Cliente
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Matrícula" value={asList(cuestionario.matricula)} />
          <Field label="Nombre" value={asList(cuestionario.nombreCliente)} />

          <Field label="Teléfono Cliente" value={asList(cuestionario.telefonoCliente)} />
          <Field label="Nº OR" value={asList(cuestionario.numeroOR)} />

          <Field label="Ciclo" value={asList(cuestionario.ciclo)} />
          <Field label="Marca/Modelo" value={asList(cuestionario.marcaModelo)} />

          <Field label="Fecha de Cita" value={asList(cuestionario.fechaCita)} />
          <Field label="Fecha Salida" value={asList(cuestionario.fechaSalida)} />

          {/* ✅ NUEVO: Asesor */}
          <Field label="Asesor" value={asList(cuestionario.asesor)} />
        </div>

        <Section title="Descripción del síntoma">
          <p className="text-sm text-gray-800">
            {asList(cuestionario.descripcion)}
          </p>
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Testigos" value={asList(cuestionario.testigos)} />
          <Field label="Mensajes" value={asList(cuestionario.mensajes)} />
        </div>

        <Section title="Detalles del síntoma"></Section>

        <Section title="Tipo">
          <p className="text-sm text-gray-800">{asList(cuestionario.tipo)}</p>
          {cuestionario.tipoOtro && (
            <p className="mt-1 text-sm">Otro: {cuestionario.tipoOtro}</p>
          )}
        </Section>

        <Section title="Categoría">
          <p className="text-sm text-gray-800">
            {asList(cuestionario.categoria)}
          </p>
        </Section>

        <Field label="Comentarios" value={asList(cuestionario.comentarios)} />
        <Field label="¿En qué parte?" value={asList(cuestionario.parteCoche)} />

        <Section title="¿Desde cuándo?">
          <p className="text-sm text-gray-800">{asList(cuestionario.desde)}</p>
          {cuestionario.desdeOtro && (
            <p className="mt-1 text-sm">Otro: {cuestionario.desdeOtro}</p>
          )}
        </Section>

        <Section title="¿Con qué frecuencia?">
          <p className="text-sm text-gray-800">
            {asList(cuestionario.frecuencia)}
          </p>
          {cuestionario.frecuenciaOtro && (
            <p className="mt-1 text-sm">
              Otro: {cuestionario.frecuenciaOtro}
            </p>
          )}
        </Section>

        <Section title="¿Dónde ocurre?">
          <p className="text-sm text-gray-800">{asList(cuestionario.donde)}</p>
          {cuestionario.dondeOtro && (
            <p className="mt-1 text-sm">Otro: {cuestionario.dondeOtro}</p>
          )}
        </Section>

        <Section title="Condiciones exteriores">
          <p className="text-sm text-gray-800">
            {asList(cuestionario.condiciones)}
          </p>
          {cuestionario.condicionesOtro && (
            <p className="mt-1 text-sm">
              Otro: {cuestionario.condicionesOtro}
            </p>
          )}
        </Section>

        <Section title="¿Cómo ocurre?">
          <p className="text-sm text-gray-800">{asList(cuestionario.como)}</p>
        </Section>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <Field label="Posición cambio" value={asList(cuestionario.posicionCambio)} />
          <Field label="Velocidad (Km/h)" value={asList(cuestionario.velocidad)} />
          <Field label="Revoluciones (rpm)" value={asList(cuestionario.revoluciones)} />
        </div>

        {cuestionario.otroLibre && (
          <Field label="Otro" value={asList(cuestionario.otroLibre)} />
        )}
      </section>

      {/* IMÁGENES DEL VEHÍCULO */}
      <section className="border-2 border-red-200 bg-red-50 rounded-lg p-4 shadow">
        <h2 className="text-xl font-semibold text-red-900 mb-4">Imágenes del vehículo</h2>

        {!loadingImagenes && imagenesVehiculo.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {imagenesVehiculo.map((img, idx) => (
              <div
                key={`${img.rutaStorage || img.name || img.url}-${idx}`}
                className="bg-white rounded-lg shadow p-3"
              >
                <img
                  src={img.url}
                  alt={img.name || "Imagen del vehículo"}
                  className="w-full h-52 object-contain rounded border"
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

        {/* RECEPCIÓN ACTIVA DEL VEHÍCULO */}
        <section className="mt-6 border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-4 text-blue-900">
            Recepción activa del vehículo
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Kilometraje" value={asList(cuestionario.recepcionKilometraje)} />
            <Field label="Nivel de combustible" value={asList(cuestionario.recepcionNivelCombustible)} />
            <Field label="Aire acondicionado enfría" value={asList(cuestionario.recepcionAireAcondicionado)} />
            <Field label="Estado alfombrillas" value={asList(cuestionario.recepcionAlfombrillasEstado)} />
          </div>

          <div className="mt-4">
            <Field
              label="Observaciones alfombrillas"
              value={asList(cuestionario.recepcionAlfombrillasObservaciones)}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field
              label="Neumático delantero derecho"
              value={asList(cuestionario.recepcionNeumaticoDelanteroDerecho)}
            />
            <Field
              label="Neumático delantero izquierdo"
              value={asList(cuestionario.recepcionNeumaticoDelanteroIzquierdo)}
            />
            <Field
              label="Neumático trasero derecho"
              value={asList(cuestionario.recepcionNeumaticoTraseroDerecho)}
            />
            <Field
              label="Neumático trasero izquierdo"
              value={asList(cuestionario.recepcionNeumaticoTraseroIzquierdo)}
            />
            <Field
              label="Estado general de limpiabrisas"
              value={asList(cuestionario.recepcionLimpiabrisasEstado)}
            />
          </div>
        </section>


      {/* FORM + PDF EN DOS COLUMNAS */}
      <form
        id="diagnosticoForm"
        onSubmit={handleSave}
        className="grid grid-cols-2 gap-6"
      >
        {/* IZQUIERDA: FORMULARIO rellenable */}
        <div className="bg-white p-6 rounded shadow max-h-[375vh] overflow-auto space-y-6">
          {/* CABECERA DEL CHECKLIST */}
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-4">
              <img
                src="https://1000marcas.net/wp-content/uploads/2019/12/logo-Toyota.png"
                alt="Logo Toyota"
                className="h-12"
              />
              <span className="text-lg font-bold">CHECKLIST VEHICULO</span>
            </div>
            <div className="text-right text-red-600 font-semibold">
              Calenda Automoción<br />
              Higuera la Real
            </div>
          </div>

          {/* DATOS DEL VH */}
          <h2 className="border-b-2 border-red-600 pb-1">Datos del VH</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: "matricula", label: "Matrícula" },
              { name: "numeroOR", label: "Nº OR" },
              { name: "ciclo", label: "Ciclo" },
              { name: "marcaModelo", label: "Marca/Modelo" },
              { name: "fechaCita", label: "Fecha de cita", type: "date" },
            ].map(({ name, label, type }) => (
              <div key={name}>
                <label className="block font-medium">{label}</label>
                <input
                  type={type || "text"}
                  name={name}
                  defaultValue={cuestionario[name] || ""}
                  className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded focus:border-red-500"
                />
              </div>
            ))}

            {/* ✅ NUEVO: Diagnosticador como desplegable (igual que en cuestionario) */}
            <div>
              <label className="block font-medium">Diagnosticador</label>
              <select
                name="diagnosticador"
                value={diagnosticador}
                onChange={(e) => setDiagnosticador(e.target.value)}
                className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded focus:border-red-500"
              >
                <option value="">Sin asignar</option>
                {mecanicos.map((m) => (
                  <option key={m.uid} value={m.nombre}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ✅ Hidden para que también se guarden en checklists.datos */}
          <input type="hidden" name="nombreCliente" defaultValue={cuestionario.nombreCliente || ""} />
          <input type="hidden" name="telefonoCliente" defaultValue={cuestionario.telefonoCliente || ""} />
          <input type="hidden" name="fechaSalida" defaultValue={cuestionario.fechaSalida || ""} />
          <input type="hidden" name="asesor" defaultValue={cuestionario.asesor || ""} />

          {/* MENSAJES */}
          <div>
            <label className="block font-medium">
              Testigos y/o mensajes del cuadro:
            </label>
            <div className="flex items-center gap-4 mt-2">
              {["si", "no"].map((v) => (
                <label key={v} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="mensaje"
                    value={v}
                    defaultChecked={cuestionario.mensaje === v}
                    className="form-radio text-red-500"
                  />
                  <span className="ml-2">{v === "si" ? "Sí" : "No"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* OBSERVACIONES MENSAJES */}
          <div>
            <label className="block font-medium">
              Observaciones (testigos/mensajes):
            </label>
            <textarea
              name="obs_testigos_mensajes"
              defaultValue={cuestionario.obs_testigos_mensajes || ""}
              rows={3}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* RECAMBIOS SOLICITADOS (RESALTADO) */}
          <div className="bg-red-400 border-l-4 border-green-700 p-4 rounded">
            <label className="block font-semibold text-black-700 mb-1">
              Recambios solicitados:
            </label>
            <textarea
              name="recambios"
              defaultValue={cuestionario.recambios || ""}
              rows={3}
              className="w-full border-2 border-blue-500 px-2 py-1 rounded resize-none focus:border-yellow-500"
            />
          </div>


          {/* ASESORES (RESALTADO VERDE) */}
          <div className="bg-green-200 border-l-4 border-green-700 p-4 rounded mt-4">
            <label className="block font-semibold text-black-700 mb-1">
              Asesores:
            </label>
            <textarea
              name="asesores"
              defaultValue={cuestionario.asesores || ""}
              rows={3}
              className="w-full border-2 border-green-500 px-2 py-1 rounded resize-none focus:border-green-700"
            />
          </div>

          {/* PUNTOS DE REVISIÓN */}
          <h2 className="text-xl font-bold border-b-2 border-red-600 pb-1">
            Puntos de revisión
          </h2>

          {/* TABLA NIVELES DE LÍQUIDOS */}
          <div>
            <strong>Niveles de líquidos:</strong>
            <table className="w-full border-2 border-gray-300 mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">🔍 Regular</th>
                  <th className="border p-2 text-center">⚠️ Requiere Cambio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "aceite", label: "Aceite motor" },
                  { key: "refrigerante", label: "Refrigerante" },
                  { key: "freno_liquido", label: "Freno líquido" },
                  { key: "embrague_liquido", label: "Embrague líquido" },
                  { key: "servo_liquido", label: "Servodirección hidráulica" },
                  { key: "limpiap_liquido", label: "Limpiaparabrisas" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        <input
                          type="radio"
                          name={key}
                          value={v}
                          defaultChecked={cuestionario[key] === v}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* NUEVO: Inspección de fugas */}
          <div className="mt-4">
            <span className="font-medium block mb-2">Inspección de fugas:</span>
            <div className="inline-flex items-center gap-6">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="inspeccion_fugas"
                  value="si"
                  defaultChecked={cuestionario.inspeccion_fugas === "si"}
                  className="form-radio"
                />
                <span className="ml-2">Sí</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="inspeccion_fugas"
                  value="no"
                  defaultChecked={cuestionario.inspeccion_fugas === "no"}
                  className="form-radio"
                />
                <span className="ml-2">No</span>
              </label>
            </div>
          </div>

          {/* Observaciones (líquidos) */}
          <div>
            <label className="block font-medium mt-4">
              Observaciones (líquidos):
            </label>
            <textarea
              name="obs_liquidos"
              defaultValue={cuestionario.obs_liquidos || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* TABLA NEUMÁTICOS */}
          <div>
            <strong>Estado de neumáticos:</strong>
            <table className="w-full border-2 border-gray-300 mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">🔍 Regular</th>
                  <th className="border p-2 text-center">⚠️ Requiere Cambio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "neuma_di", label: "Delantero Izq. (DI)" },
                  { key: "neuma_dd", label: "Delantero Der. (DD)" },
                  { key: "neuma_ti", label: "Trasero Izq. (TI)" },
                  { key: "neuma_td", label: "Trasero Der. (TD)" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        <input
                          type="radio"
                          name={key}
                          value={v}
                          defaultChecked={cuestionario[key] === v}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block font-medium mt-4">
              Observaciones (neumáticos):
            </label>
            <textarea
              name="obs_neumaticos"
              defaultValue={cuestionario.obs_neumaticos || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* TABLA FRENOS */}
          <div>
            <strong>Frenos:</strong>
            <table className="w-full border-2 border-gray-300 mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">🔍 Regular</th>
                  <th className="border p-2 text-center">⚠️ Requiere Cambio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "frenos_discos", label: "Discos" },
                  { key: "frenos_pastillas", label: "Pastillas" },
                  { key: "frenos_racores", label: "Racores flexibles" },
                  { key: "freno_est", label: "Freno estacionamiento" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        <input
                          type="radio"
                          name={key}
                          value={v}
                          defaultChecked={cuestionario[key] === v}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block font-medium mt-4">
              Observaciones (frenos):
            </label>
            <textarea
              name="obs_frenos"
              defaultValue={cuestionario.obs_frenos || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* Limpiaparabrisas */}
          <div className="mt-6">
            <strong className="block mb-2">Limpiaparabrisas:</strong>
            <table className="w-full border-2 border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">🔍 Regular</th>
                  <th className="border p-2 text-center">⚠️ Requiere Cambio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "limpia_func", label: "Funcionamiento" },
                  { key: "limpia_escobillas_di", label: "Estado de escobillas (DI)" },
                  { key: "limpia_escobillas_dd", label: "Estado de escobillas (DD)" },
                  { key: "limpia_escobillas_trasera", label: "Estado de escobillas (Trasera)" },
                  { key: "limpia_surt_di", label: "Surtidores de líquido (DI)" },
                  { key: "limpia_surt_dd", label: "Surtidores de líquido (DD)" },
                  { key: "limpia_surt_tr", label: "Surtidores de líquido (Trasero)" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        <input
                          type="radio"
                          name={key}
                          value={v}
                          defaultChecked={cuestionario[key] === v}
                          className="form-radio"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observaciones Limpiaparabrisas */}
          <div className="mt-4">
            <label className="block font-medium">
              Observaciones (limpiaparabrisas):
            </label>
            <textarea
              name="obs_limpiaparabrisas"
              defaultValue={cuestionario.obs_limpiaparabrisas || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>


          {/* Bombillas */}
          <div className="mt-6">
            <strong className="block mb-2">Bombillas:</strong>
            <table className="w-full border-2 border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">❌ Mal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-2">Estado general de bombillas</td>
                  {["bien", "mal"].map((v) => (
                    <td key={v} className="border p-2 text-center">
                      <input
                        type="radio"
                        name="bombillas_estado"
                        value={v}
                        defaultChecked={cuestionario.bombillas_estado === v}
                        className="form-radio"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div className="mt-4">
              <label className="block font-medium">
                Observaciones (bombillas que están mal):
              </label>
              <textarea
                name="obs_bombillas"
                defaultValue={cuestionario.obs_bombillas || ""}
                rows={2}
                className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
                placeholder="Ej: Luz de cruce izq, posición trasera dcha…"
              />
            </div>
          </div>

          {/* Otros elementos */}
          <div className="mt-6">
            <strong className="block mb-2">Otros elementos:</strong>
            <table className="w-full border-2 border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2"></th>
                  <th className="border p-2 text-center">✅ Bien</th>
                  <th className="border p-2 text-center">🔍 Regular</th>
                  <th className="border p-2 text-center">⚠️ Requiere Cambio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "otros_rotulas", label: "Guardapolvos de rótulas" },
                  { key: "otros_fuelles", label: "Fuelles de transmisión" },
                  { key: "otros_amort", label: "Amortiguadores" },
                  { key: "otros_escape", label: "Línea de escape" },
                  { key: "otros_tanque", label: "Tanque de combustible" },
                  { key: "otros_cubre", label: "Cubre bajos" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border p-2">{label}</td>
                    {["bien", "regular", "cambio"].map((v) => (
                      <td key={v} className="border p-2 text-center">
                        <input
                          type="radio"
                          name={key}
                          value={v}
                          defaultChecked={cuestionario[key] === v}
                          className="form-radio"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Observaciones Otros elementos */}
          <div className="mt-4">
            <label className="block font-medium">
              Observaciones (otros elementos):
            </label>
            <textarea
              name="obs_otros"
              defaultValue={cuestionario.obs_otros || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* Estado de la batería */}
          <div className="mt-6">
            <strong className="block mb-2">Estado de la batería:</strong>
            <div className="inline-flex items-center gap-6">
              {["correcto", "incorrecto", "carga"].map((v) => (
                <label key={v} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="bateria"
                    value={v}
                    defaultChecked={cuestionario.bateria === v}
                    className="form-radio"
                  />
                  <span className="ml-2">
                    {v === "carga"
                      ? "Necesita Carga"
                      : v.charAt(0).toUpperCase() + v.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Observaciones Batería */}
          <div className="mt-4">
            <label className="block font-medium">
              Observaciones (batería):
            </label>
            <textarea
              name="obs_bateria"
              defaultValue={cuestionario.obs_bateria || ""}
              rows={2}
              className="mt-1 w-full border-2 border-gray-300 px-2 py-1 rounded resize-none focus:border-red-500"
            />
          </div>

          {/* BOTÓN GUARDAR */}
          <div className="text-center mt-6">
            {error && <p className="text-red-600 mb-2">{error}</p>}
            <button
              type="submit"
              disabled={guardando}
              className="px-6 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar checklist"}
            </button>
          </div>
        </div>

        {/* DERECHA: PDF para imprimir */}
        <div className="bg-white p-6 rounded shadow max-h-[100vh] overflow-auto">
          <iframe
            src="/checklist_formulario.pdf"
            title="Checklist Cliente PDF"
            className="w-full h-full border-2 border-gray-300"
          />
        </div>
      </form>
    </main>
  );
}
