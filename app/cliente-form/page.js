// app/cliente-form/page.js
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { setDoc, doc, collection, serverTimestamp } from "firebase/firestore";

export default function ClienteFormPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  // 2) Guardar en Firestore con estado
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const datos = readFormData();
      // guardado con ID personalizado: matricula-numeroOR
      const docId = `${datos.matricula}-${datos.numeroOR}`;
      await setDoc(doc(db, "cuestionarios_cliente", docId), {
        uidAsesor: user.uid,
        creadoEn: serverTimestamp(),
        estado: "PENDIENTE_DIAGNOSTICO",
        estadoPresupuesto: "PENDIENTE_PRESUPUESTO",
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
    <main className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Nuevo Cuestionario Cliente</h1>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Volver
        </button>
      </div>

      <div className="flex gap-6">
        {/* IZQUIERDA: FORMULARIO WEB */}
        <form
          id="clienteWebForm"
          onSubmit={handleSave}
          className="w-1/2 bg-white p-6 rounded shadow space-y-4 overflow-visible"
        >
          {/* Datos VH */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

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
          <div className="grid grid-cols-2 gap-4">
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
            <div className="flex gap-4 text-sm">
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
              <label className="inline-flex items-center">
                Otro:
                <input
                  name="tipoOtro"
                  type="text"
                  className="ml-1 w-24 border px-1 text-sm rounded"
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
            <div className="flex gap-4 text-sm">
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
              <label className="inline-flex items-center">
                Otro:
                <input
                  name="desdeOtro"
                  type="text"
                  className="ml-1 w-24 border px-1 text-sm rounded"
                />
              </label>
            </div>
          </div>

          {/* Frecuencia */}
          <div>
            <label className="block text-xs font-bold mb-1">
              ¿Con qué frecuencia?
            </label>
            <div className="flex gap-4 text-sm">
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
              <label className="inline-flex items-center">
                Otro:
                <input
                  name="frecuenciaOtro"
                  type="text"
                  className="ml-1 w-24 border px-1 text-sm rounded"
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
              <label className="inline-flex items-center">
                Otro:
                <input
                  name="dondeOtro"
                  type="text"
                  className="ml-1 w-24 border px-1 text-sm rounded"
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
              <label className="inline-flex items-center">
                Otro:
                <input
                  name="condicionesOtro"
                  type="text"
                  className="ml-1 w-24 border px-1 text-sm rounded"
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
          <div className="grid grid-cols-3 gap-4">
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

        {/* DERECHA: PDF embebido */}
        <div className="w-1/2 bg-white rounded shadow overflow-hidden">
          <iframe
            src="/cuestionario_cliente_formulario.pdf#toolbar=1&zoom=page-width"
            className="w-full h-[100vh]"
          />
        </div>
      </div>
    </main>
  );
}
