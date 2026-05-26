"use client";

import { LOGO_TOYOTA } from "./BrandLogos";

const asText = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v === null || v === undefined) return "";
  return String(v);
};

const has = (arr, value) => {
  const a = Array.isArray(arr) ? arr : [arr].filter(Boolean);
  const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  return a.some((x) => norm(x) === norm(value));
};

function Box({ children, className = "" }) {
  return <div className={`border border-[#aab4c4] bg-[#f3f6ff] min-h-[22px] px-2 py-1 text-[11px] leading-tight ${className}`}>{children || ""}</div>;
}

function Check({ checked }) {
  return <span className="inline-flex h-[13px] w-[13px] items-center justify-center border border-[#aab4c4] bg-[#f8fbff] text-[9px] font-black leading-none text-slate-900">{checked ? "✓" : ""}</span>;
}

function CheckItem({ label, checked }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap"><span>{label}</span><Check checked={checked} /></span>;
}

function FieldLine({ label, value, className = "" }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[11px] font-black text-slate-800 whitespace-nowrap">{label}</span>
      <Box className="flex-1">{asText(value)}</Box>
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

      <div className="print-sheet mx-auto w-[794px] min-h-[1123px] bg-white p-7 shadow-xl text-slate-900">
        <header className="mb-3 border-b-[5px] border-red-400 pb-2">
          <div className="grid grid-cols-[140px_1fr_185px] items-center gap-3">
            <div className="flex justify-center">
              <img src={LOGO_TOYOTA} alt="Toyota" className="h-16 w-auto object-contain" />
            </div>
            <div className="text-left">
              <h1 className="text-[22px] font-black tracking-tight text-slate-800">CUESTIONARIO DE SÍNTOMAS</h1>
            </div>
            <div className="text-right">
              <p className="text-[15px] font-black leading-tight">CALENDA AUTOMOCIÓN</p>
              <p className="text-[12px] font-bold">HIGUERA LA REAL</p>
            </div>
          </div>
        </header>

        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-black">Datos del VH</h2>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <FieldLine label="Matrícula:" value={datos.matricula} />
              <FieldLine label="Fecha Cita:" value={datos.fechaCita} />
            </div>
            <div className="grid grid-cols-[1.7fr_.8fr] gap-4">
              <FieldLine label="Modelo:" value={datos.marcaModelo} />
              <FieldLine label="Nº OR:" value={datos.numeroOR} />
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <FieldLine label="Cliente:" value={datos.nombreCliente} />
              <FieldLine label="Teléfono:" value={datos.telefonoCliente} />
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <FieldLine label="Asesor:" value={datos.asesor} />
              <FieldLine label="Mecánico:" value={datos.mecanicoNombre} />
            </div>
          </div>
        </section>

        <section className="mb-3">
          <h2 className="mb-1 text-[13px] font-black">Descripción del síntoma por el cliente</h2>
          <Box className="min-h-[74px] whitespace-pre-wrap text-[12px]">{asText(datos.descripcion)}</Box>
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
              <span className="font-black">Tipo:</span>
              <CheckItem label="Ruido" checked={has(datos.tipo, "Ruido") || has(datos.tipo, "ruido")} />
              <CheckItem label="Vibración" checked={has(datos.tipo, "Vibración") || has(datos.tipo, "vibracion")} />
              <FieldLine label="Otro:" value={datos.tipoOtro} className="flex-1 min-w-[180px]" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black">Categoría:</span>
              {["Motor", "Chasis", "Electrónica", "Dirección", "Frenos", "SistemaHibrido"].map((c) => (
                <CheckItem key={c} label={c === "SistemaHibrido" ? "Sist. Híbrido" : c} checked={has(datos.categoria, c)} />
              ))}
            </div>

            <FieldLine label="Comentarios:" value={datos.comentarios} />
            <FieldLine label="¿En qué parte del coche ocurre?" value={datos.parteCoche} />

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black">¿Desde cuándo?</span>
              <CheckItem label="1 día o menos" checked={has(datos.desde, "1 día o menos") || has(datos.desde, "1dia")} />
              <CheckItem label=">1 semana" checked={has(datos.desde, "> 1 semana") || has(datos.desde, "1semana")} />
              <FieldLine label="Otro:" value={datos.desdeOtro} className="flex-1 min-w-[150px]" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-black">¿Con qué frecuencia?</span>
              <CheckItem label="1 vez al día" checked={has(datos.frecuencia, "1 vez al día") || has(datos.frecuencia, "1vez")} />
              <CheckItem label="Ocasionalmente" checked={has(datos.frecuencia, "Ocasionalmente")} />
              <CheckItem label="Siempre" checked={has(datos.frecuencia, "Siempre")} />
              <FieldLine label="Otro:" value={datos.frecuenciaOtro} className="flex-1 min-w-[150px]" />
            </div>

            <div className="grid grid-cols-[118px_1fr_210px] gap-2">
              <span className="font-black">¿Dónde ocurre?</span>
              <div className="flex flex-wrap gap-3">
                {["Nacional", "Autopista", "Ciudad", "Adoquines", "Tierra", "Baches"].map((c) => <CheckItem key={c} label={c} checked={has(datos.donde, c)} />)}
              </div>
              <FieldLine label="Otro:" value={datos.dondeOtro} />
            </div>

            <div className="grid grid-cols-[118px_1fr_210px] gap-2">
              <span className="font-black">Condiciones exteriores:</span>
              <div className="flex flex-wrap gap-3">
                {["Mojado", "Seco", "Viento", "VehiculoFrio", "VehiculoCaliente"].map((c) => <CheckItem key={c} label={c.replace("Vehiculo", "Vehículo ")} checked={has(datos.condiciones, c)} />)}
              </div>
              <FieldLine label="Otro:" value={datos.condicionesOtro} />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2"><span className="font-black">¿Cómo ocurre?</span></div>
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

        <section className="mt-4 border border-slate-300 p-3">
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
