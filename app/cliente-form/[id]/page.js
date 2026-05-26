"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { fetchMecanicos } from "../../../lib/userProfile";
import VehicleImages from "@/components/VehicleImages";

export default function ClienteFormDetail() {
  const params = useParams();
  const id = decodeURIComponent(params.id);
  const router = useRouter();
  const [cuestionario, setCuestionario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEditados, setDatosEditados] = useState({});

  const [mecanicos, setMecanicos] = useState([]);

  const handleCampoChange = useCallback((campo, valor) => {
    setDatosEditados((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get("edit") === "true") {
      setModoEdicion(true);
    }
  }, []);

  // Cargar mecánicos para poder reasignar el trabajo
  useEffect(() => {
    fetchMecanicos()
      .then(setMecanicos)
      .catch(() => setMecanicos([]));
  }, []);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
    }
  }, []);

  useEffect(() => {
    async function load() {
      const ref = doc(db, "cuestionarios_cliente", id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        router.replace("/dashboard");
        return;
      }
      const datos = snap.data().datos || {};
      setCuestionario(datos);
      setDatosEditados(datos);
      try {
        document.title = `${datos.matricula} - ${datos.numeroOR} - ${datos.nombreCliente || ""}`.trim();
      } catch (e) {}
      setLoading(false);
    }
    load();
  }, [id, router]);

  const guardarCambios = async () => {
    try {
      const ref = doc(db, "cuestionarios_cliente", id);
      const mec = mecanicos.find((m) => m.uid === (datosEditados.mecanicoUid || ""));
      await updateDoc(ref, {
        datos: {
          ...datosEditados,
          mecanicoNombre: datosEditados.mecanicoUid ? (mec?.nombre || datosEditados.mecanicoNombre || "") : "",
        },
        // duplicamos para poder filtrar por mecánico sin leer datos
        asignadoMecanicoUid: datosEditados.mecanicoUid || null,
        asignadoMecanicoNombre: datosEditados.mecanicoUid ? (mec?.nombre || datosEditados.mecanicoNombre || null) : null,
      });
      alert("Cambios guardados correctamente.");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    }
  };

  if (loading) return <p className="p-6 text-center">Cargando…</p>;
  if (!cuestionario) return null;

  const renderCheckboxGroup = (label, field, opciones, otroField) => (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
      <div className="flex flex-wrap gap-2 mb-2">
        {opciones.map((op) => (
          <label key={op} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={(datosEditados[field] || []).includes(op)}
              disabled={!modoEdicion}
              onChange={(e) => {
                if (!modoEdicion) return;
                const actual = new Set(datosEditados[field] || []);
                if (e.target.checked) actual.add(op);
                else actual.delete(op);
                handleCampoChange(field, Array.from(actual));
              }}
            />
            {op}
          </label>
        ))}
      </div>
      {otroField && (
        <div>
          <p className="text-xs font-bold text-gray-600 mb-1">Otro:</p>
          <input
            type="text"
            value={datosEditados[otroField] || ""}
            onChange={(e) => handleCampoChange(otroField, e.target.value)}
            className="border border-gray-300 px-2 py-1 rounded w-full"
            disabled={!modoEdicion}
          />
        </div>
      )}
    </div>
  );

  const renderInput = (label, field, type = "text") => (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
      <input
        type={type}
        className="border border-gray-300 px-2 py-1 rounded w-full"
        value={datosEditados[field] || ""}
        onChange={(e) => handleCampoChange(field, e.target.value)}
        disabled={!modoEdicion}
      />
    </div>
  );

  const renderRadioGroup = (label, field, opciones) => (
    <div>
      <p className="text-xs font-bold text-gray-600 mb-1">{label}</p>
      <div className="flex flex-wrap gap-3 text-sm">
        {opciones.map((op) => (
          <label key={op} className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={field}
              checked={(datosEditados[field] || "") === op}
              disabled={!modoEdicion}
              onChange={() => handleCampoChange(field, op)}
            />
            {op}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Detalle Cuestionario</h1>
          <p className="text-sm text-gray-500">La versión imprimible se abre aparte y usa estos mismos datos guardados.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => router.push(`/cliente-form/${encodeURIComponent(id)}/imprimible`)}
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-semibold"
          >
            🖨️ Versión imprimible
          </button>
          {modoEdicion && (
            <button
              onClick={guardarCambios}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
            >
              Guardar Cambios
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
          >
            Volver
          </button>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded shadow space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderInput("Matrícula", "matricula")}
          {renderInput("Nombre", "nombreCliente")}
          {renderInput("Teléfono Cliente", "telefonoCliente")}
          {renderInput("Nº OR", "numeroOR")}
          {renderInput("Ciclo", "ciclo")}
          {renderInput("Marca/Modelo", "marcaModelo")}
          {renderInput("Fecha de Cita", "fechaCita", "date")}
          {renderInput("Fecha Salida", "fechaSalida", "date")}

          {/* Asesor justo después de las fechas */}
          {renderInput("Asesor", "asesor")}

          {/* Mecánico (opcional) */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">
              Mecánico (opcional)
            </p>
            <select
              className="border border-gray-300 px-2 py-1 rounded w-full"
              value={datosEditados.mecanicoUid || ""}
              onChange={(e) => handleCampoChange("mecanicoUid", e.target.value)}
              disabled={!modoEdicion}
            >
              <option value="">Sin asignar</option>
              {mecanicos.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {!!datosEditados.mecanicoUid && (
              <p className="mt-1 text-[11px] text-gray-500">
                Asignado a: <b>{mecanicos.find((m) => m.uid === datosEditados.mecanicoUid)?.nombre || datosEditados.mecanicoNombre || ""}</b>
              </p>
            )}
          </div>
        </div>

        <VehicleImages
          cuestionarioId={id}
          matricula={datosEditados.matricula || cuestionario.matricula}
          numeroOR={datosEditados.numeroOR || cuestionario.numeroOR}
          compact
        />

        <section className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-blue-900">Recepción activa del vehículo</h2>
            <p className="text-xs text-blue-700">Datos registrados en la entrada del vehículo al taller.</p>
          </div>

          {renderInput("Kilometraje", "recepcionKilometraje")}
          {renderRadioGroup("Nivel de combustible", "recepcionNivelCombustible", ["R", "1/4", "1/2", "3/4", "1"])}
          {renderRadioGroup("Estado del aire acondicionado (Enfría)", "recepcionAireAcondicionado", ["Sí", "No"])}

          <div className="space-y-2">
            {renderRadioGroup("Estado de las alfombrillas", "recepcionAlfombrillasEstado", ["Correcto", "Verificar", "Cambiar"])}
            {renderInput("Observaciones alfombrillas", "recepcionAlfombrillasObservaciones")}
          </div>

          {renderRadioGroup("Neumático delantero derecho", "recepcionNeumaticoDelanteroDerecho", ["Bueno (>3 mm)", "Medio (1.6 mm - 3 mm)", "Reemplazar (<1.6 mm)"])}
          {renderRadioGroup("Neumático delantero izquierdo", "recepcionNeumaticoDelanteroIzquierdo", ["Bueno (>3 mm)", "Medio (1.6 mm - 3 mm)", "Reemplazar (<1.6 mm)"])}
          {renderRadioGroup("Neumático trasero derecho", "recepcionNeumaticoTraseroDerecho", ["Bueno (>3 mm)", "Medio (1.6 mm - 3 mm)", "Reemplazar (<1.6 mm)"])}
          {renderRadioGroup("Neumático trasero izquierdo", "recepcionNeumaticoTraseroIzquierdo", ["Bueno (>3 mm)", "Medio (1.6 mm - 3 mm)", "Reemplazar (<1.6 mm)"])}
          {renderRadioGroup("Estado general de limpiabrisas", "recepcionLimpiabrisasEstado", ["Correcto", "Verificar", "Cambiar"])}
        </section>

        {renderInput("Descripción del síntoma", "descripcion")}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {renderInput("Testigos", "testigos")}
          {renderInput("Mensajes", "mensajes")}
        </div>

        {renderCheckboxGroup("Tipo", "tipo", ["Ruido", "Vibración"], "tipoOtro")}
        {renderCheckboxGroup("Categoría", "categoria", ["Motor", "Chasis", "Electrónica", "Dirección", "Frenos", "SistemaHibrido"])}
        {renderInput("Comentarios", "comentarios")}
        {renderInput("¿En qué parte del coche ocurre?", "parteCoche")}
        {renderCheckboxGroup("¿Desde cuándo?", "desde", ["1 día o menos", "> 1 semana"], "desdeOtro")}
        {renderCheckboxGroup("¿Con qué frecuencia?", "frecuencia", ["1 vez al día", "Ocasionalmente", "Siempre"], "frecuenciaOtro")}
        {renderCheckboxGroup("¿Dónde ocurre?", "donde", ["Nacional", "Autopista", "Ciudad", "Adoquines", "Tierra", "Baches"], "dondeOtro")}
        {renderCheckboxGroup("Condiciones exteriores", "condiciones", ["Mojado", "Seco", "Viento", "VehiculoFrio", "VehiculoCaliente"], "condicionesOtro")}
        {renderCheckboxGroup("¿Cómo ocurre?", "como", ["Aparcando", "Acelerando", "Ralenti", "CambioMarcha", "Reteniendo", "EnRecta", "Remolque", "MuyCargado", "Seco", "CurvasIzq", "CurvasDer"])}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {renderInput("Posición cambio", "posicionCambio")}
          {renderInput("Velocidad (Km/h)", "velocidad")}
          {renderInput("Revoluciones (rpm)", "revoluciones")}
        </div>

        {renderInput("Otro", "otroLibre")}
      </div>
    </main>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-gray-700 mb-1">{title}</h3>
      <div className="pl-2 text-sm">{children}</div>
    </div>
  );
}

function asList(mix) {
  if (!mix) return "—";
  if (Array.isArray(mix)) return mix.join(", ");
  return mix;
}
