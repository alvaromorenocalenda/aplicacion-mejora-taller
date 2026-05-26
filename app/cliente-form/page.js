// app/cliente-form/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { fetchMecanicos } from "../../lib/userProfile";

export default function ClienteFormPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Mecánicos para asignación (opcional)
  const [mecanicos, setMecanicos] = useState([]);
  const [mecanicoUid, setMecanicoUid] = useState("");

  // 1) Proteger ruta
  useEffect(() => {
    const u = auth.currentUser;
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    setChecking(false);
  }, [router]);

  // Cargar lista de mecánicos (si existe colección usuarios)
  useEffect(() => {
    fetchMecanicos()
      .then(setMecanicos)
      .catch(() => setMecanicos([]));
  }, []);

  if (checking) return <p className="p-6 text-center">Comprobando sesión…</p>;
  if (!user) return null;

  // Leer todos los campos del form
  function readFormData() {
    const form = document.getElementById("clienteWebForm");
    const fm = new FormData(form);
    const out = {};
    for (const [k, v] of fm.entries()) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    }
    return out;
  }

  function abrirVersionImprimibleBorrador() {
    const datos = readFormData();
    const mec = mecanicos.find((m) => m.uid === mecanicoUid);
    if (mecanicoUid) {
      datos.mecanicoUid = mecanicoUid;
      datos.mecanicoNombre = mec?.nombre || "";
    }
    sessionStorage.setItem("cuestionarioImprimibleBorrador", JSON.stringify(datos));
    window.open("/cliente-form/imprimible", "_blank");
  }

  // 2) Guardar en Firestore con estado
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const datos = readFormData();

      // Resolver nombre del mecánico (si se seleccionó)
      const mec = mecanicos.find((m) => m.uid === mecanicoUid);
      if (mecanicoUid) {
        datos.mecanicoUid = mecanicoUid;
        datos.mecanicoNombre = mec?.nombre || "";
      } else {
        delete datos.mecanicoUid;
        delete datos.mecanicoNombre;
      }

      // guardado con ID personalizado: matricula-numeroOR
      const docId = `${datos.matricula}-${datos.numeroOR}`;
      await setDoc(doc(db, "cuestionarios_cliente", docId), {
        uidAsesor: user.uid,
        creadoEn: serverTimestamp(),
        estado: "PENDIENTE_DIAGNOSTICO",
        estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
        // Asignación (opcional)
        asignadoMecanicoUid: mecanicoUid || null,
        asignadoMecanicoNombre: mec?.nombre || null,
        datos,
      });
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Nuevo Cuestionario Cliente</h1>
          <p className="text-sm text-gray-500">Rellena una vez y usa la versión imprimible cuando quieras.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={abrirVersionImprimibleBorrador}
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-semibold"
          >
            🖨️ Versión imprimible
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
          >
            Volver
          </button>
        </div>
      </div>

      {/* FORMULARIO WEB */}
      <form
        id="clienteWebForm"
        onSubmit={handleSave}
        className="bg-white p-4 sm:p-6 rounded shadow space-y-4 overflow-visible"
      >
        {/* Datos VH */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold">Matrícula:</label>
            <input
              name="matricula"
              type="text"
              required
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Nombre:</label>
            <input
              name="nombreCliente"
              type="text"
              required
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-bold">
              Teléfono Cliente:
            </label>
            <input
              name="telefonoCliente"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Nº OR:</label>
            <input
              name="numeroOR"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-bold">Ciclo:</label>
            <input
              name="ciclo"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Marca/Modelo:</label>
            <input
              name="marcaModelo"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>

          <div>
            <label className="block text-xs font-bold">Fecha Cita:</label>
            <input
              name="fechaCita"
              type="date"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Fecha Salida:</label>
            <input
              name="fechaSalida"
              type="date"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>

          {/* Asesor (justo después de fechas) */}
          <div>
            <label className="block text-xs font-bold">Asesor:</label>
            <input
              name="asesor"
              type="text"
              required
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>

          {/* Mecánico (opcional) */}
          <div>
            <label className="block text-xs font-bold">Mecánico (opcional):</label>
            <select
              value={mecanicoUid}
              onChange={(e) => setMecanicoUid(e.target.value)}
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            >
              <option value="">Sin asignar</option>
              {mecanicos.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>


        {/* Recepción activa del vehículo */}
        <section className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-blue-900">Recepción activa del vehículo</h2>
            <p className="text-xs text-blue-700">Revisión rápida en la entrada del vehículo al taller.</p>
          </div>

          <div>
            <label className="block text-xs font-bold">Kilometraje:</label>
            <input
              name="recepcionKilometraje"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded bg-white"
              placeholder="Ej: 125000"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Nivel de combustible:</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {["R", "1/4", "1/2", "3/4", "1"].map((opt) => (
                <label key={opt} className="inline-flex items-center">
                  <input type="radio" name="recepcionNivelCombustible" value={opt} className="mr-1" />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Estado del aire acondicionado (Enfría):</label>
            <div className="flex gap-4 text-sm">
              {["Sí", "No"].map((opt) => (
                <label key={opt} className="inline-flex items-center">
                  <input type="radio" name="recepcionAireAcondicionado" value={opt} className="mr-1" />
                  {opt}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold mb-1">Estado de las alfombrillas:</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {["Correcto", "Verificar", "Cambiar"].map((opt) => (
                <label key={opt} className="inline-flex items-center">
                  <input type="radio" name="recepcionAlfombrillasEstado" value={opt} className="mr-1" />
                  {opt}
                </label>
              ))}
            </div>
            <input
              name="recepcionAlfombrillasObservaciones"
              type="text"
              className="w-full border px-2 py-1 text-sm rounded bg-white"
              placeholder="Observaciones"
            />
          </div>

          <div className="space-y-3">
            {[
              ["Neumático delantero derecho", "recepcionNeumaticoDelanteroDerecho"],
              ["Neumático delantero izquierdo", "recepcionNeumaticoDelanteroIzquierdo"],
              ["Neumático trasero derecho", "recepcionNeumaticoTraseroDerecho"],
              ["Neumático trasero izquierdo", "recepcionNeumaticoTraseroIzquierdo"],
            ].map(([label, name]) => (
              <div key={name}>
                <label className="block text-xs font-bold mb-1">{label}:</label>
                <div className="flex flex-wrap gap-4 text-sm">
                  {[
                    "Bueno (>3 mm)",
                    "Medio (1.6 mm - 3 mm)",
                    "Reemplazar (<1.6 mm)",
                  ].map((opt) => (
                    <label key={opt} className="inline-flex items-center">
                      <input type="radio" name={name} value={opt} className="mr-1" />
                      {opt}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold mb-1">Estado general de limpiabrisas:</label>
            <div className="flex flex-wrap gap-4 text-sm">
              {["Correcto", "Verificar", "Cambiar"].map((opt) => (
                <label key={opt} className="inline-flex items-center">
                  <input type="radio" name="recepcionLimpiabrisasEstado" value={opt} className="mr-1" />
                  {opt}
                </label>
              ))}
            </div>
          </div>
        </section>

        {/* Descripción síntoma */}
        <div>
          <label className="block text-xs font-bold">
            Descripción del síntoma:
          </label>
          <textarea
            name="descripcion"
            rows={3}
            className="mt-1 w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        {/* Testigos / mensajes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold">Testigos:</label>
            <input
              name="testigos"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Mensajes:</label>
            <input
              name="mensajes"
              type="text"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold mb-1">
            Detalles del síntoma
          </label>
        </div>

        {/* Tipo */}
        <div>
          <label className="block text-xs font-bold mb-1">Tipo:</label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                name="tipo"
                value="ruido"
                className="form-checkbox mr-1"
              />
              Ruido
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                name="tipo"
                value="vibracion"
                className="form-checkbox mr-1"
              />
              Vibración
            </label>
            <label className="inline-flex items-center gap-1">
              Otro:
              <input
                name="tipoOtro"
                type="text"
                className="w-28 border px-1 text-sm rounded"
              />
            </label>
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="block text-xs font-bold mb-1">Categoría:</label>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              "Motor",
              "Chasis",
              "Electrónica",
              "Dirección",
              "Frenos",
              "SistemaHibrido",
            ].map((cat) => (
              <label key={cat} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="categoria"
                  value={cat}
                  className="form-checkbox mr-1"
                />
                {cat}
              </label>
            ))}
          </div>
        </div>

        {/* Comentarios */}
        <div>
          <label className="block text-xs font-bold">Comentarios:</label>
          <input
            name="comentarios"
            type="text"
            className="mt-1 w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        {/* ¿En qué parte? */}
        <div>
          <label className="block text-xs font-bold">
            ¿En qué parte del coche ocurre?
          </label>
          <input
            name="parteCoche"
            type="text"
            className="mt-1 w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        {/* ¿Desde cuándo? */}
        <div>
          <label className="block text-xs font-bold mb-1">
            ¿Desde cuándo?
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                name="desde"
                value="1dia"
                className="form-checkbox mr-1"
              />
              1 día o menos
            </label>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                name="desde"
                value="1semana"
                className="form-checkbox mr-1"
              />
              &gt; 1 semana
            </label>
            <label className="inline-flex items-center gap-1">
              Otro:
              <input
                name="desdeOtro"
                type="text"
                className="w-28 border px-1 text-sm rounded"
              />
            </label>
          </div>
        </div>

        {/* Frecuencia */}
        <div>
          <label className="block text-xs font-bold mb-1">
            ¿Con qué frecuencia?
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            {["1vez", "Ocasionalmente", "Siempre"].map((opt, i) => (
              <label key={i} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="frecuencia"
                  value={opt}
                  className="form-checkbox mr-1"
                />
                {opt === "1vez" ? "1 vez al día" : opt}
              </label>
            ))}
            <label className="inline-flex items-center gap-1">
              Otro:
              <input
                name="frecuenciaOtro"
                type="text"
                className="w-28 border px-1 text-sm rounded"
              />
            </label>
          </div>
        </div>

        {/* Dónde ocurre */}
        <div>
          <label className="block text-xs font-bold mb-1">
            ¿Dónde ocurre?
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              "Nacional",
              "Autopista",
              "Ciudad",
              "Adoquines",
              "Tierra",
              "Baches",
            ].map((opt) => (
              <label key={opt} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="donde"
                  value={opt}
                  className="form-checkbox mr-1"
                />
                {opt}
              </label>
            ))}
            <label className="inline-flex items-center gap-1">
              Otro:
              <input
                name="dondeOtro"
                type="text"
                className="w-28 border px-1 text-sm rounded"
              />
            </label>
          </div>
        </div>

        {/* Condiciones exteriores */}
        <div>
          <label className="block text-xs font-bold mb-1">
            Condiciones exteriores:
          </label>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              "Mojado",
              "Seco",
              "Viento",
              "VehiculoFrio",
              "VehiculoCaliente",
            ].map((opt) => (
              <label key={opt} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="condiciones"
                  value={opt}
                  className="form-checkbox mr-1"
                />
                {opt}
              </label>
            ))}
            <label className="inline-flex items-center gap-1">
              Otro:
              <input
                name="condicionesOtro"
                type="text"
                className="w-28 border px-1 text-sm rounded"
              />
            </label>
          </div>
        </div>

        {/* ¿Cómo ocurre? */}
        <div>
          <label className="block text-xs font-bold mb-1">¿Cómo ocurre?</label>
          <div className="flex flex-wrap gap-4 text-sm">
            {[
              "Aparcando",
              "Acelerando",
              "Ralenti",
              "CambioMarcha",
              "Reteniendo",
              "EnRecta",
              "Remolque",
              "MuyCargado",
              "Seco",
              "CurvasIzq",
              "CurvasDer",
            ].map((opt) => (
              <label key={opt} className="inline-flex items-center">
                <input
                  type="checkbox"
                  name="como"
                  value={opt}
                  className="form-checkbox mr-1"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {/* Valores numéricos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold">Posición cambio:</label>
            <input
              name="posicionCambio"
              type="number"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Velocidad (Km/h):</label>
            <input
              name="velocidad"
              type="number"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-bold">Revoluciones (rpm):</label>
            <input
              name="revoluciones"
              type="number"
              className="mt-1 w-full border px-2 py-1 text-sm rounded"
            />
          </div>
        </div>

        {/* Otro texto libre */}
        <div>
          <label className="block text-xs font-bold">Otro:</label>
          <input
            name="otroLibre"
            type="text"
            className="mt-1 w-full border px-2 py-1 text-sm rounded"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="text-center">
          <button
            type="submit"
            disabled={saving}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar Cuestionario"}
          </button>
        </div>
      </form>
    </main>
  );
}
