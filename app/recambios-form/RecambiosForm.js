"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function RecambiosForm({
  initialEntries = [],   // filas iniciales
  onSubmit,              // callback para “Guardar”
  readOnly = false       // si es true, oculta botones
}) {
  const [entries, setEntries] = useState(initialEntries);

  // Cuando cambien las initialEntries (por ejemplo al cargar detalle),
  // resetea el estado:
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const handleChange = (i, field, v) => {
    const copia = [...entries];
    copia[i][field] = v;
    setEntries(copia);
  };

  const addEntry = () => {
    if (readOnly) return;
    setEntries([
      ...entries,
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
        fechaPrevista: "", // <-- NUEVO
        fechaLlegada: "",
        observacionesInf: "",
        recambista: "",
      }
    ]);
  };

  const removeEntry = (i) => {
    if (readOnly) return;
    setEntries(entries.filter((_, j) => j !== i));
  };

  const handleSave = () => {
    if (readOnly || !onSubmit) return;
    onSubmit(entries);
  };

  return (
    <div className="p-6 bg-[#FAF9F6] min-h-screen">
      {/* Tabla */}
      <div className="overflow-auto rounded-lg shadow bg-white">
        <table className="min-w-full border-collapse">
          <tbody>
            {entries.map((e, idx) => {
              const letra = String.fromCharCode(65 + idx);
              const fondo = idx % 2 ? "bg-[#F1F3F8]" : "bg-[#FFFFFF]";
              return (
                <React.Fragment key={idx}>
                  {/* Cabecera fila 1 */}
                  <tr className="bg-[#B3D9FF]">
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Letra</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Referencia anterior</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Marca anterior</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Descripción</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Diagnosticador</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#1E3A5F]">Observaciones</th>
                  </tr>
                  {/* Inputs fila 1 */}
                  <tr className={fondo}>
                    <td className="border px-2 py-1 text-center align-middle">{letra}</td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.referenciaAnterior}
                        onChange={ev => handleChange(idx, "referenciaAnterior", ev.target.value)}
                        className="w-full bg-[#E3F2FD] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.marcaAnterior}
                        onChange={ev => handleChange(idx, "marcaAnterior", ev.target.value)}
                        className="w-full bg-[#E3F2FD] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.descripcion}
                        onChange={ev => handleChange(idx, "descripcion", ev.target.value)}
                        className="w-full bg-[#E3F2FD] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.diagnosticador}
                        onChange={ev => handleChange(idx, "diagnosticador", ev.target.value)}
                        className="w-full bg-[#E3F2FD] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.observacionesSup}
                        onChange={ev => handleChange(idx, "observacionesSup", ev.target.value)}
                        className="w-full bg-[#E3F2FD] px-2 py-1 rounded text-sm"
                      />
                    </td>
                  </tr>

                  {/* Cabecera fila 2 */}
                  <tr className="bg-[#D3D3D3]">
                    <th></th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Referencia Tramitada</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Fecha Pedido</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Proveedor</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Transporte</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Fecha prevista de llegada</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Fecha Llegada</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Observaciones</th>
                    <th className="p-3 text-center text-sm font-semibold text-[#333]">Recambista</th>
                    <th className="p-3"></th>
                  </tr>
                  {/* Inputs fila 2 */}
                  <tr className={fondo}>
                    <td></td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.referenciaTramitada}
                        onChange={ev => handleChange(idx, "referenciaTramitada", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="date"
                        value={e.fechaPedido}
                        onChange={ev => handleChange(idx, "fechaPedido", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.proveedor}
                        onChange={ev => handleChange(idx, "proveedor", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.transporte}
                        onChange={ev => handleChange(idx, "transporte", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="date"
                        value={e.fechaPrevista}
                        onChange={ev => handleChange(idx, "fechaPrevista", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="date"
                        value={e.fechaLlegada}
                        onChange={ev => handleChange(idx, "fechaLlegada", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.observacionesInf}
                        onChange={ev => handleChange(idx, "observacionesInf", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        type="text"
                        value={e.recambista}
                        onChange={ev => handleChange(idx, "recambista", ev.target.value)}
                        className="w-full bg-[#F0F0F0] px-2 py-1 rounded text-sm"
                      />
                    </td>
                    {!readOnly && (
                      <td className="p-2 text-right">
                        <button
                          onClick={() => removeEntry(idx)}
                          className="px-3 py-1 bg-red-400 text-white rounded hover:bg-red-500 text-sm"
                        >
                          Eliminar fila
                        </button>
                      </td>
                    )}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div className="mt-6 flex justify-between">
          <button
            onClick={addEntry}
            className="px-6 py-2 bg-[#A8E6CF] text-[#1F433D] rounded hover:bg-[#8ED8B2]"
          >
            + Añadir fila
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#FFD3B6] text-[#6F3E18] rounded hover:bg-[#FFC39E]"
          >
            💾 Guardar Recambios
          </button>
        </div>
      )}
    </div>
  );
}
