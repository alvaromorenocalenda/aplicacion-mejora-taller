// components/ChecklistForm.js
"use client";

import { useState } from "react";
import { updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function ChecklistForm({ item, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lee dinámicamente todo el formulario
  function readChecklistData() {
    const form = document.getElementById("checklistForm");
    const fm = new FormData(form);
    const out = {};
    for (const [k, v] of fm.entries()) {
      if (out[k] === undefined) out[k] = v;
      else if (Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    }
    return out;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const checklist = readChecklistData();
     await updateDoc(doc(db, "cuestionarios_cliente", item.id), {
        estado: "DIAGNOSTICO_COMPLETADO",
        checklist,
        actualizadoEn: serverTimestamp(),
      });
      
      // 🔔 Marcar recambios como editados
      try {
        const ref = doc(db, "recambios", item.id);
        await updateDoc(ref, { checklistEditada: true });
      } catch (e) {
        console.log("No hay documento de recambios para marcar como editado.");
      }

      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form
        id="checklistForm"
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded shadow max-w-5xl w-full overflow-auto max-h-[90vh]"
      >
        {/* === INICIO DE TU HTML ADAPTADO === */}
        <div className="container mx-auto">
          <div className="header flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <img src="/logo-Toyota.png" alt="Logo Toyota" className="h-8" />
              <span className="font-bold">CHECKLIST VEHÍCULO</span>
            </div>
            <div className="text-right text-red-600 font-semibold text-sm">
              Calenda Automoción<br />
              Higuera la Real
            </div>
          </div>

          {/* Datos del VH */}
          <h2 className="border-b-2 border-red-600 pb-1 text-lg">Datos del VH</h2>
          <div className="grid grid-cols-3 gap-4 mt-2">
            {[
              ["matricula", "Matrícula"],
              ["numeroOR", "Nº OR"],
              ["ciclo", "Ciclo"],
              ["marcaModelo", "Marca/Modelo"],
              ["fechaCita", "Fecha de cita"],
            ].map(([name, label]) => (
              <div key={name} className="flex flex-col">
                <label htmlFor={name} className="text-sm font-medium">{label}</label>
                <input
                  type={name === "fechaCita" ? "date" : "text"}
                  id={name}
                  name={name}
                  defaultValue={item.datos[name] ?? ""}
                  className="mt-1 border px-2 py-1 rounded"
                />
              </div>
            ))}
          </div>

          {/* Testigos */}
          <div className="mt-4">
            <label className="text-sm font-medium">Testigos y/o mensajes del cuadro:</label>
            <div className="flex items-center gap-4 mt-1">
              {["si", "no"].map((val) => (
                <label key={val} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="mensaje"
                    value={val}
                    defaultChecked={item.datos.mensaje === val}
                    className="mr-1"
                  />
                  {val === "si" ? "Sí" : "No"}
                </label>
              ))}
            </div>
            <textarea
              name="obs_testigosMensajes"
              defaultValue={item.checklist?.obs_testigosMensajes || ""}
              placeholder="Observaciones..."
              className="mt-2 w-full border p-2 rounded"
            />
          </div>

          {/* Recambios */}
          <div className="mt-4 bg-yellow-100 p-2 rounded border">
            <label className="font-semibold">Recambios solicitados:</label>
            <textarea
              name="recambios"
              defaultValue={item.checklist?.recambios || ""}
              placeholder="Detalle los recambios necesarios"
              className="mt-1 w-full border p-2 rounded"
            />
          </div>

          {/* Función helper para renderizar cada sección de tabla */}
          {[
            {
              title: "Niveles de líquidos",
              fields: [
                ["aceite", "Aceite motor"],
                ["refrigerante", "Refrigerante"],
                ["freno_liquido", "Freno"],
                ["embrague_liquido", "Embrague"],
                ["servo_liquido", "Servodirección hidráulica"],
                ["limpiap_liquido", "Limpiaparabrisas"],
              ],
            },
            {
              title: "Estado de neumáticos",
              fields: [
                ["neuma_di", "Delantero Izquierdo"],
                ["neuma_dd", "Delantero Derecho"],
                ["neuma_ti", "Trasero Izquierdo"],
                ["neuma_td", "Trasero Derecho"],
              ],
            },
            {
              title: "Frenos",
              fields: [
                ["frenos_discos", "Discos"],
                ["frenos_pastillas", "Pastillas"],
                ["frenos_racores", "Racores flexibles"],
                ["freno_est", "Freno estacionamiento"],
              ],
            },
            {
              title: "Limpiaparabrisas",
              fields: [
                ["limpia_func", "Funcionamiento"],
                ["limpia_escobillas_di", "Escobillas DI"],
                ["limpia_escobillas_dd", "Escobillas DD"],
                ["limpia_escobillas_tr", "Escobillas Trasera"],
                ["limpia_surt_di", "Surtidores DI"],
                ["limpia_surt_dd", "Surtidores DD"],
                ["limpia_surt_tr", "Surtidores Trasero"],
              ],
            },
            {
              title: "Otros elementos",
              fields: [
                ["otros_rotulas", "Guardapolvos de rótulas"],
                ["otros_fuelles", "Fuelles de transmisión"],
                ["otros_amort", "Amortiguadores"],
                ["otros_escape", "Línea de escape"],
                ["otros_tanque", "Tanque de combustible"],
                ["otros_cubre", "Cubre bajos"],
              ],
            },
          ].map((section) => (
            <div key={section.title} className="mt-6">
              <h2 className="border-b-2 border-red-600 pb-1 text-lg">{section.title}</h2>
              <table className="w-full border-collapse border mt-2">
                <thead>
                  <tr>
                    <th className="border px-2 py-1 text-left"></th>
                    {["bien", "regular", "cambio"].map((val, i) => (
                      <th key={i} className="border px-2 py-1 text-center">
                        {val === "bien" ? "✅" : val === "regular" ? "🔍" : "⚠️"}
                        <div className="text-xs">{val === "bien" ? "Bien" : val === "regular" ? "Regular" : "Requiere Cambio"}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.fields.map(([name, label]) => (
                    <tr key={name}>
                      <td className="border px-2 py-1">{label}</td>
                      {["bien", "regular", "cambio"].map((val) => (
                        <td key={val} className="border px-2 py-1 text-center">
                          <input
                            type="radio"
                            name={name}
                            value={val}
                            defaultChecked={item.checklist?.[name] === val}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <textarea
                name={`obs_${section.title.replace(/\s+/g, "").toLowerCase()}`}
                placeholder={`Observaciones (${section.title.toLowerCase()}):`}
                defaultValue={item.checklist?.[`obs_${section.title.replace(/\s+/g, "").toLowerCase()}`] || ""}
                className="mt-2 w-full border p-2 rounded"
              />
            </div>
          ))}

          {/* Estado de la batería */}
          <div className="mt-6">
            <h2 className="border-b-2 border-red-600 pb-1 text-lg">Estado de la batería</h2>
            <div className="inline-flex gap-4 mt-2">
              {[
                ["correcto", "Correcto"],
                ["incorrecto", "Incorrecto"],
                ["carga", "Necesita Carga"],
              ].map(([val, label]) => (
                <label key={val} className="inline-flex items-center">
                  <input
                    type="radio"
                    name="bateria"
                    value={val}
                    defaultChecked={item.checklist?.bateria === val}
                    className="mr-1"
                  />
                  {label}
                </label>
              ))}
            </div>
            <textarea
              name="obs_bateria"
              placeholder="Observaciones batería"
              defaultValue={item.checklist?.obs_bateria || ""}
              className="mt-2 w-full border p-2 rounded"
            />
          </div>
        </div>
        {/* === FIN DE TU HTML ADAPTADO === */}

        {error && <p className="text-red-600 mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar Checklist"}
          </button>
        </div>
      </form>
    </div>
  );
}
