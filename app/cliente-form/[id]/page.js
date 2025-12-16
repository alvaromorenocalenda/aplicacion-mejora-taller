"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function ClienteFormDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [cuestionario, setCuestionario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [datosEditados, setDatosEditados] = useState({});

  const handleCampoChange = useCallback((campo, valor) => {
    setDatosEditados((prev) => ({ ...prev, [campo]: valor }));
  }, []);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get("edit") === "true") {
      setModoEdicion(true);
    }
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
      await updateDoc(ref, {
        datos: datosEditados,
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

  return (
    <main className="p-6 max-w-screen-xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Detalle Cuestionario</h1>
        <div className="flex gap-4">
          {modoEdicion && (
            <button
              onClick={guardarCambios}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Guardar Cambios
            </button>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded shadow space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {renderInput("Descripción del síntoma", "descripcion")}

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
            {renderInput("Posición cambio", "posicionCambio")}
            {renderInput("Velocidad (Km/h)", "velocidad")}
            {renderInput("Revoluciones (rpm)", "revoluciones")}
          </div>

          {renderInput("Otro", "otroLibre")}
        </div>

        <div className="bg-white p-2 rounded shadow overflow-hidden">
          <iframe
            src="/cuestionario_cliente_formulario.pdf#toolbar=1&zoom=page-width"
            title="PDF Cuestionario"
            className="w-full h-[calc(110vh-100px)]"
          />
        </div>
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
