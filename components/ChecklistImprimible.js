"use client";

import { LOGO_TOYOTA } from "./BrandLogos";

const asText = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v === null || v === undefined) return "";
  return String(v);
};

function Box({ children, className = "" }) {
  return (
    <div className={`print-box border border-[#aab4c4] bg-[#f8fbff] min-h-[18px] px-1.5 py-[2px] text-[9px] leading-tight ${className}`}>
      {children || ""}
    </div>
  );
}

function FieldLine({ label, value, className = "" }) {
  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <span className="pt-[3px] text-[9px] font-black text-slate-800 whitespace-nowrap">{label}</span>
      <Box className="flex-1">{asText(value)}</Box>
    </div>
  );
}

function CheckCell({ active }) {
  return <td className="border border-slate-400 px-1 py-[2px] text-center text-[10px] font-black">{active ? "✓" : ""}</td>;
}

function ReviewTable({ title, rows, values = ["bien", "regular", "cambio"], labels = ["Bien", "Regular", "Cambio"] }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-1 text-[10px] font-black text-slate-900">{title}</h3>
      <table className="w-full border-collapse text-[8.5px] leading-tight">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-1 py-[2px] text-left">Elemento</th>
            {labels.map((l) => (
              <th key={l} className="w-[48px] border border-slate-400 px-1 py-[2px] text-center">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border border-slate-400 px-1 py-[2px]">{r.label}</td>
              {values.map((v) => <CheckCell key={v} active={String(r.value || "").toLowerCase() === v} />)}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const LIQUIDOS = [
  ["aceite", "Aceite motor"],
  ["refrigerante", "Refrigerante"],
  ["freno_liquido", "Freno líquido"],
  ["embrague_liquido", "Embrague líquido"],
  ["servo_liquido", "Servodirección hidráulica"],
  ["limpiap_liquido", "Limpiaparabrisas"],
];

const BLOQUES = [
  { title: "Neumáticos", keys: [["neuma_di", "DI"], ["neuma_dd", "DD"], ["neuma_ti", "TI"], ["neuma_td", "TD"]], obs: "obs_neumaticos" },
  { title: "Frenos", keys: [["frenos_discos", "Discos"], ["frenos_pastillas", "Pastillas"], ["frenos_racores", "Racores flexibles"], ["freno_est", "Freno estacionamiento"]], obs: "obs_frenos" },
  { title: "Limpiaparabrisas", keys: [["limpia_func", "Funcionamiento"], ["limpia_escobillas_di", "Escobillas DI"], ["limpia_escobillas_dd", "Escobillas DD"], ["limpia_escobillas_trasera", "Escobilla trasera"], ["limpia_surt_di", "Surtidor DI"], ["limpia_surt_dd", "Surtidor DD"], ["limpia_surt_tr", "Surtidor trasero"]], obs: "obs_limpiaparabrisas" },
  { title: "Bombillas", keys: [["bombillas_estado", "Estado general"]], obs: "obs_bombillas", values: ["bien", "mal"], labels: ["Bien", "Mal"] },
  { title: "Otros elementos", keys: [["otros_rotulas", "Guardapolvos rótulas"], ["otros_fuelles", "Fuelles transmisión"], ["otros_amort", "Amortiguadores"], ["otros_escape", "Línea escape"], ["otros_tanque", "Tanque combustible"], ["otros_cubre", "Cubre bajos"]], obs: "obs_otros" },
];

export default function ChecklistImprimible({ datos = {}, onBack }) {
  const rows = (pairs) => pairs.map(([key, label]) => ({ key, label, value: datos[key] }));

  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        .print-box { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 5mm; }
          .print-sheet { box-shadow: none !important; width: 100% !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-col gap-2 sm:flex-row sm:justify-between">
        <button onClick={onBack} className="rounded bg-gray-600 px-4 py-2 font-semibold text-white">← Volver a checklist</button>
        <button onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div className="print-sheet mx-auto w-[794px] bg-white p-5 shadow-xl text-slate-900">
        <header className="mb-2 border-b-[4px] border-red-500 pb-1.5">
          <div className="grid grid-cols-[120px_1fr_150px] items-center gap-2">
            <img src={LOGO_TOYOTA} alt="Toyota" className="h-16 w-auto object-contain" />
            <h1 className="text-[19px] font-black leading-5 tracking-tight text-slate-800">CHECKLIST<br />VEHÍCULO</h1>
            <div className="text-right"><p className="text-[12px] font-black leading-tight">CALENDA AUTOMOCIÓN</p><p className="text-[9px] font-bold">HIGUERA LA REAL</p></div>
          </div>
        </header>

        <section className="mb-2">
          <h2 className="mb-1 text-[12px] font-black">Datos del VH</h2>
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Matrícula:" value={datos.matricula} /><FieldLine label="Nº OR:" value={datos.numeroOR} /></div>
            <div className="grid grid-cols-[1.6fr_1fr] gap-2"><FieldLine label="Modelo:" value={datos.marcaModelo} /><FieldLine label="Fecha cita:" value={datos.fechaCita} /></div>
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Cliente:" value={datos.nombreCliente} /><FieldLine label="Teléfono:" value={datos.telefonoCliente} /></div>
            <div className="grid grid-cols-2 gap-2"><FieldLine label="Asesor:" value={datos.asesor} /><FieldLine label="Diagnosticador:" value={datos.diagnosticador} /></div>
          </div>
        </section>

        <section className="mb-2 border border-blue-200 bg-blue-50 p-2">
          <h2 className="mb-1 text-[12px] font-black text-blue-900">Recepción activa del vehículo</h2>
          <div className="grid grid-cols-2 gap-1.5 text-[9px]">
            <FieldLine label="Kilometraje:" value={datos.recepcionKilometraje} />
            <FieldLine label="Combustible:" value={datos.recepcionNivelCombustible} />
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

        <section className="mb-2 grid grid-cols-[1fr_1fr] gap-3">
          <ReviewTable title="Niveles de líquidos" rows={rows(LIQUIDOS)} />
          <section className="break-inside-avoid">
            <h3 className="mb-1 text-[10px] font-black text-slate-900">Inspección de fugas</h3>
            <table className="w-full border-collapse text-[8.5px]">
              <thead><tr className="bg-slate-100"><th className="border border-slate-400 px-1 py-[2px] text-left">Elemento</th><th className="border border-slate-400 px-1 py-[2px] text-center">Sí</th><th className="border border-slate-400 px-1 py-[2px] text-center">No</th></tr></thead>
              <tbody><tr><td className="border border-slate-400 px-1 py-[2px]">Fugas</td><CheckCell active={datos.inspeccion_fugas === "si"} /><CheckCell active={datos.inspeccion_fugas === "no"} /></tr></tbody>
            </table>
            <FieldLine label="Obs. líquidos:" value={datos.obs_liquidos} className="mt-2" />
          </section>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-2">
          {BLOQUES.map((b) => (
            <div key={b.title} className="break-inside-avoid">
              <ReviewTable title={b.title} rows={rows(b.keys)} values={b.values || ["bien", "regular", "cambio"]} labels={b.labels || ["Bien", "Regular", "Cambio"]} />
              <FieldLine label="Obs.:" value={datos[b.obs]} className="mt-1" />
            </div>
          ))}
        </section>

        <section className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-300 pt-2">
          <FieldLine label="Batería:" value={datos.bateria} />
          <FieldLine label="Obs. batería:" value={datos.obs_bateria} />
          <FieldLine label="Recambios:" value={datos.recambios} className="col-span-2" />
          <FieldLine label="Asesores:" value={datos.asesores} className="col-span-2" />
          <FieldLine label="Observaciones testigos/mensajes:" value={datos.obs_testigos_mensajes} className="col-span-2" />
        </section>
      </div>
    </main>
  );
}
