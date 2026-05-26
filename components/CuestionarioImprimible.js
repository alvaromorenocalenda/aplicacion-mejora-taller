"use client";

const asText = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v === null || v === undefined) return "";
  return String(v);
};

const has = (arr, value) => {
  const a = Array.isArray(arr) ? arr : [arr].filter(Boolean);
  const norm = (x) => String(x || "").toLowerCase().replace(/\s+/g, "");
  return a.some((x) => norm(x) === norm(value));
};

function Box({ children, className = "" }) {
  return <div className={`border border-slate-400 bg-blue-50/40 min-h-[24px] px-2 py-1 text-[11px] ${className}`}>{children || ""}</div>;
}

function Check({ checked }) {
  return <span className="inline-flex h-4 w-4 items-center justify-center border border-slate-500 bg-white text-[11px] leading-none">{checked ? "✓" : ""}</span>;
}

function CheckItem({ label, checked }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap"><span>{label}</span><Check checked={checked} /></span>;
}

function FieldLine({ label, value, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">{label}</span>
      <Box className="flex-1 min-h-[24px]">{asText(value)}</Box>
    </div>
  );
}

export default function CuestionarioImprimible({ datos = {}, onBack }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 8mm; }
          .print-sheet { box-shadow: none !important; width: 100% !important; min-height: auto !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-col gap-2 sm:flex-row sm:justify-between">
        <button onClick={onBack} className="rounded bg-gray-600 px-4 py-2 font-semibold text-white">← Volver al cuestionario</button>
        <button onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div className="print-sheet mx-auto w-[794px] min-h-[1123px] bg-white p-8 shadow-xl text-slate-900">
        <header className="mb-3 grid grid-cols-[120px_1fr_180px] items-start gap-3 border-b-4 border-red-500 pb-2">
          <div className="flex justify-center pt-1">
            <div className="relative h-14 w-24">
              <div className="absolute left-2 top-7 h-5 w-16 rounded-full bg-red-600" />
              <div className="absolute left-8 top-2 h-9 w-11 rounded-t-full bg-red-500" />
              <div className="absolute left-5 top-10 h-4 w-4 rounded-full bg-slate-900" />
              <div className="absolute right-1 top-10 h-4 w-4 rounded-full bg-slate-900" />
              <div className="absolute left-0 top-0 h-14 w-24 rounded-full border-[6px] border-slate-800 border-b-transparent border-r-transparent rotate-[-12deg]" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-[22px] font-black tracking-tight">CUESTIONARIO DE SÍNTOMAS</h1>
          </div>
          <div className="text-right">
            <p className="text-[15px] font-black">CALENDA AUTOMOCIÓN</p>
            <p className="text-[12px] font-bold">HIGUERA LA REAL</p>
          </div>
        </header>

        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-black">Datos del VH</h2>
          <div className="grid grid-cols-4 gap-x-3 gap-y-2">
            <FieldLine label="Matrícula:" value={datos.matricula} className="col-span-2" />
            <FieldLine label="Fecha Cita:" value={datos.fechaCita} className="col-span-2" />
            <FieldLine label="Modelo:" value={datos.marcaModelo} className="col-span-3" />
            <FieldLine label="Nº OR:" value={datos.numeroOR} className="col-span-1" />
            <FieldLine label="Cliente:" value={datos.nombreCliente} className="col-span-2" />
            <FieldLine label="Teléfono:" value={datos.telefonoCliente} className="col-span-2" />
            <FieldLine label="Asesor:" value={datos.asesor} className="col-span-2" />
            <FieldLine label="Mecánico:" value={datos.mecanicoNombre} className="col-span-2" />
          </div>
        </section>

        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-black">Descripción del síntoma por el cliente</h2>
          <Box className="min-h-[78px] whitespace-pre-wrap text-[12px]">{asText(datos.descripcion)}</Box>
        </section>

        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-black">Testigos y/o mensajes del cuadro</h2>
          <div className="grid grid-cols-2 gap-2">
            <FieldLine label="Testigos:" value={datos.testigos} />
            <FieldLine label="Mensajes:" value={datos.mensajes} />
          </div>
        </section>

        <section className="mb-3 border-t border-slate-300 pt-2">
          <h2 className="mb-2 text-[13px] font-black">Detalles del síntoma</h2>
          <div className="space-y-2 text-[11px]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">Tipo:</span>
              <CheckItem label="Ruido" checked={has(datos.tipo, "Ruido") || has(datos.tipo, "ruido")} />
              <CheckItem label="Vibración" checked={has(datos.tipo, "Vibración") || has(datos.tipo, "vibracion")} />
              <FieldLine label="Otro:" value={datos.tipoOtro} className="flex-1 min-w-[180px]" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">Categoría:</span>
              {["Motor", "Chasis", "Electrónica", "Dirección", "Frenos", "SistemaHibrido"].map((c) => (
                <CheckItem key={c} label={c === "SistemaHibrido" ? "Sist. Híbrido" : c} checked={has(datos.categoria, c)} />
              ))}
            </div>

            <FieldLine label="Comentarios:" value={datos.comentarios} />
            <FieldLine label="¿En qué parte del coche ocurre?" value={datos.parteCoche} />

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">¿Desde cuándo?</span>
              <CheckItem label="1 día o menos" checked={has(datos.desde, "1 día o menos") || has(datos.desde, "1dia")} />
              <CheckItem label=">1 semana" checked={has(datos.desde, "> 1 semana") || has(datos.desde, "1semana")} />
              <FieldLine label="Otro:" value={datos.desdeOtro} className="flex-1 min-w-[150px]" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold">¿Con qué frecuencia?</span>
              <CheckItem label="1 vez al día" checked={has(datos.frecuencia, "1 vez al día") || has(datos.frecuencia, "1vez")} />
              <CheckItem label="Ocasionalmente" checked={has(datos.frecuencia, "Ocasionalmente")} />
              <CheckItem label="Siempre" checked={has(datos.frecuencia, "Siempre")} />
              <FieldLine label="Otro:" value={datos.frecuenciaOtro} className="flex-1 min-w-[150px]" />
            </div>

            <div className="grid grid-cols-[120px_1fr_220px] gap-2">
              <span className="font-bold">¿Dónde ocurre?</span>
              <div className="flex flex-wrap gap-3">
                {["Nacional", "Autopista", "Ciudad", "Adoquines", "Tierra", "Baches"].map((c) => <CheckItem key={c} label={c} checked={has(datos.donde, c)} />)}
              </div>
              <FieldLine label="Otro:" value={datos.dondeOtro} />
            </div>

            <div className="grid grid-cols-[120px_1fr_220px] gap-2">
              <span className="font-bold">Condiciones exteriores:</span>
              <div className="flex flex-wrap gap-3">
                {["Mojado", "Seco", "Viento", "VehiculoFrio", "VehiculoCaliente"].map((c) => <CheckItem key={c} label={c.replace("Vehiculo", "Vehículo ")} checked={has(datos.condiciones, c)} />)}
              </div>
              <FieldLine label="Otro:" value={datos.condicionesOtro} />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2"><span className="font-bold">¿Cómo ocurre?</span></div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-1">
                {["Aparcando", "Acelerando", "Ralenti", "CambioMarcha", "Reteniendo", "EnRecta", "Remolque", "MuyCargado", "Seco", "CurvasIzq", "CurvasDer"].map((c) => <CheckItem key={c} label={c.replace("CambioMarcha", "Cambio de marcha").replace("EnRecta", "En recta").replace("MuyCargado", "Muy cargado").replace("CurvasIzq", "En curvas izq.").replace("CurvasDer", "En curvas der.")} checked={has(datos.como, c)} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-3 grid grid-cols-3 gap-2 border-t border-slate-300 pt-2">
          <FieldLine label="Posición cambio:" value={datos.posicionCambio} />
          <FieldLine label="Velocidad (Km/h):" value={datos.velocidad} />
          <FieldLine label="Revoluciones (rpm):" value={datos.revoluciones} />
        </section>

        <section className="mb-3">
          <FieldLine label="Otro:" value={datos.otroLibre} />
        </section>

        <section className="mt-4 rounded border border-slate-300 p-3">
          <h2 className="mb-2 text-[13px] font-black">Recepción activa del vehículo</h2>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <FieldLine label="Kilometraje:" value={datos.recepcionKilometraje} />
            <FieldLine label="Nivel combustible:" value={datos.recepcionNivelCombustible} />
            <FieldLine label="A/A enfría:" value={datos.recepcionAireAcondicionado} />
            <FieldLine label="Alfombrillas:" value={datos.recepcionAlfombrillasEstado} />
            <FieldLine label="Obs. alfombrillas:" value={datos.recepcionAlfombrillasObservaciones} className="col-span-2" />
            <FieldLine label="Neumático DD:" value={datos.recepcionNeumaticoDelanteroDerecho} />
            <FieldLine label="Neumático DI:" value={datos.recepcionNeumaticoDelanteroIzquierdo} />
            <FieldLine label="Neumático TD:" value={datos.recepcionNeumaticoTraseroDerecho} />
            <FieldLine label="Neumático TI:" value={datos.recepcionNeumaticoTraseroIzquierdo} />
            <FieldLine label="Limpiabrisas:" value={datos.recepcionLimpiabrisasEstado} className="col-span-2" />
          </div>
        </section>
      </div>
    </main>
  );
}
