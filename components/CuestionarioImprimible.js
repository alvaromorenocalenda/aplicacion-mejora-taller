"use client";

import { LOGO_TOYOTA } from "./BrandLogos";

const asText = (v) => Array.isArray(v) ? v.join(", ") : (v == null ? "" : String(v));
const norm = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const has = (arr, value) => (Array.isArray(arr) ? arr : [arr].filter(Boolean)).some((x) => norm(x) === norm(value));

function Box({ children, className = "" }) {
  return (
    <div className={`print-box border border-[#aab4c4] bg-[#f3f6ff] min-h-[19px] px-1.5 py-[2px] text-[9px] leading-tight ${className}`}>
      {children || ""}
    </div>
  );
}

function Check({ checked }) {
  return <span className="inline-flex h-[10px] w-[10px] items-center justify-center border border-[#aab4c4] bg-[#f8fbff] text-[7px] font-black leading-none text-slate-900">{checked ? "✓" : ""}</span>;
}

function CheckItem({ label, checked }) {
  return <span className="inline-flex items-center gap-[3px] whitespace-nowrap"><span>{label}</span><Check checked={checked} /></span>;
}

function FieldLine({ label, value, className = "" }) {
  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <span className="pt-[3px] text-[9px] font-black text-slate-800 whitespace-nowrap">{label}</span>
      <Box className="flex-1">{asText(value)}</Box>
    </div>
  );
}

export default function CuestionarioImprimible({ datos = {}, onBack }) {
  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        .print-box {
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          word-break: break-word;
          hyphens: auto;
        }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 5mm; }
          .print-sheet {
            box-shadow: none !important;
            width: 100% !important;
            min-height: 0 !important;
            padding: 0 !important;
            transform: scale(.96);
            transform-origin: top left;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-col gap-2 sm:flex-row sm:justify-between">
        <button onClick={onBack} className="rounded bg-gray-600 px-4 py-2 font-semibold text-white">← Volver al cuestionario</button>
        <button onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div className="print-sheet mx-auto w-[794px] bg-white p-5 shadow-xl text-slate-900">
        <header className="mb-2 border-b-[4px] border-red-400 pb-1.5">
          <div className="grid grid-cols-[120px_1fr_150px] items-center gap-2">
            <img src={LOGO_TOYOTA} alt="Toyota" className="h-16 w-auto object-contain" />
            <h1 className="text-[19px] font-black leading-5 tracking-tight text-slate-800">CUESTIONARIO DE<br/>SÍNTOMAS</h1>
            <div className="text-right"><p className="text-[12px] font-black leading-tight">CALENDA AUTOMOCIÓN</p><p className="text-[9px] font-bold">HIGUERA LA REAL</p></div>
          </div>
        </header>

        <section className="mb-2">
          <h2 className="mb-1 text-[12px] font-black">Datos del VH</h2>
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Matrícula:" value={datos.matricula} /><FieldLine label="Fecha Cita:" value={datos.fechaCita} /></div>
            <div className="grid grid-cols-[1.8fr_.8fr] gap-2"><FieldLine label="Modelo:" value={datos.marcaModelo} /><FieldLine label="Nº OR:" value={datos.numeroOR} /></div>
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Cliente:" value={datos.nombreCliente} /><FieldLine label="Teléfono:" value={datos.telefonoCliente} /></div>
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Asesor:" value={datos.asesor} /><FieldLine label="Mecánico:" value={datos.mecanicoNombre} /></div>
          </div>
        </section>

        <section className="mb-2">
          <h2 className="mb-1 text-[12px] font-black">Descripción del síntoma por el cliente</h2>
          <Box className="min-h-[82px] max-h-[112px] overflow-hidden text-[10px] leading-[1.12rem]">{asText(datos.descripcion)}</Box>
        </section>

        <section className="mb-2"><h2 className="mb-1 text-[12px] font-black">Testigos y/o mensajes del cuadro</h2><div className="grid grid-cols-2 gap-2"><FieldLine label="Testigos:" value={datos.testigos} /><FieldLine label="Mensajes:" value={datos.mensajes} /></div></section>

        <section className="mb-2 border-t border-slate-300 pt-1.5">
          <h2 className="mb-1 text-[12px] font-black">Detalles del síntoma</h2>
          <div className="space-y-1 text-[9px] leading-tight">
            <div className="flex flex-wrap items-center gap-2"><span className="font-black">Tipo:</span><CheckItem label="Ruido" checked={has(datos.tipo, "Ruido") || has(datos.tipo, "ruido")} /><CheckItem label="Vibración" checked={has(datos.tipo, "Vibración") || has(datos.tipo, "vibracion")} /><FieldLine label="Otro:" value={datos.tipoOtro} className="flex-1 min-w-[150px]" /></div>
            <div className="flex flex-wrap items-center gap-2"><span className="font-black">Categoría:</span>{["Motor", "Chasis", "Electrónica", "Dirección", "Frenos", "SistemaHibrido"].map((c) => <CheckItem key={c} label={c === "SistemaHibrido" ? "Sist. Híbrido" : c} checked={has(datos.categoria, c)} />)}</div>
            <FieldLine label="Comentarios:" value={datos.comentarios} />
            <FieldLine label="¿En qué parte del coche ocurre?" value={datos.parteCoche} />
            <div className="flex flex-wrap items-center gap-2"><span className="font-black">¿Desde cuándo?</span><CheckItem label="1 día o menos" checked={has(datos.desde, "1 día o menos") || has(datos.desde, "1dia")} /><CheckItem label=">1 semana" checked={has(datos.desde, "> 1 semana") || has(datos.desde, "1semana")} /><FieldLine label="Otro:" value={datos.desdeOtro} className="flex-1 min-w-[120px]" /></div>
            <div className="flex flex-wrap items-center gap-2"><span className="font-black">¿Con qué frecuencia?</span><CheckItem label="1 vez al día" checked={has(datos.frecuencia, "1 vez al día") || has(datos.frecuencia, "1vez")} /><CheckItem label="Ocasionalmente" checked={has(datos.frecuencia, "Ocasionalmente")} /><CheckItem label="Siempre" checked={has(datos.frecuencia, "Siempre")} /><FieldLine label="Otro:" value={datos.frecuenciaOtro} className="flex-1 min-w-[120px]" /></div>
            <div className="grid grid-cols-[95px_1fr_160px] gap-1.5"><span className="font-black">¿Dónde ocurre?</span><div className="flex flex-wrap gap-2">{["Nacional", "Autopista", "Ciudad", "Adoquines", "Tierra", "Baches"].map((c) => <CheckItem key={c} label={c} checked={has(datos.donde, c)} />)}</div><FieldLine label="Otro:" value={datos.dondeOtro} /></div>
            <div className="grid grid-cols-[95px_1fr_160px] gap-1.5"><span className="font-black">Condiciones exteriores:</span><div className="flex flex-wrap gap-2">{["Mojado", "Seco", "Viento", "VehiculoFrio", "VehiculoCaliente"].map((c) => <CheckItem key={c} label={c.replace("Vehiculo", "Vehículo ")} checked={has(datos.condiciones, c)} />)}</div><FieldLine label="Otro:" value={datos.condicionesOtro} /></div>
            <div><span className="font-black">¿Cómo ocurre?</span><div className="mt-1 grid grid-cols-4 gap-x-2 gap-y-0.5">{["Aparcando", "Acelerando", "Ralenti", "CambioMarcha", "Reteniendo", "EnRecta", "Remolque", "MuyCargado", "Seco", "CurvasIzq", "CurvasDer"].map((c) => <CheckItem key={c} label={c.replace("CambioMarcha", "Cambio de marcha").replace("EnRecta", "En recta").replace("MuyCargado", "Muy cargado").replace("CurvasIzq", "En curvas izq.").replace("CurvasDer", "En curvas der.")} checked={has(datos.como, c)} />)}</div></div>
          </div>
        </section>

        <section className="mb-2 grid grid-cols-3 gap-2 border-t border-slate-300 pt-1.5"><FieldLine label="Posición cambio:" value={datos.posicionCambio} /><FieldLine label="Velocidad (Km/h):" value={datos.velocidad} /><FieldLine label="Revoluciones (rpm):" value={datos.revoluciones} /></section>
        <section className="mb-2"><FieldLine label="Otro:" value={datos.otroLibre} /></section>

        <section className="mt-2 border border-slate-300 p-2">
          <h2 className="mb-1 text-[12px] font-black">Recepción activa del vehículo</h2>
          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
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
