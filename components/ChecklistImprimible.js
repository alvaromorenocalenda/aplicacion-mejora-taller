"use client";

import { LOGO_TOYOTA } from "./BrandLogos";

const asText = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v === null || v === undefined) return "";
  return String(v);
};

function Box({ children, className = "" }) {
  return (
    <div className={`print-box border border-[#9aa3b2] bg-[#f8fbff] min-h-[14px] px-1 py-[1px] text-[7.2px] leading-[1.05] ${className}`}>
      {children || ""}
    </div>
  );
}

function FieldLine({ label, value, className = "" }) {
  return (
    <div className={`flex items-start gap-1 ${className}`}>
      <span className="pt-[2px] text-[7.2px] font-black text-slate-800 whitespace-nowrap">{label}</span>
      <Box className="flex-1">{asText(value)}</Box>
    </div>
  );
}

function CheckCell({ active }) {
  return <td className="border border-slate-400 px-[2px] py-[1px] text-center text-[8px] font-black leading-none">{active ? "✓" : ""}</td>;
}

function ReviewTable({ title, rows, values = ["bien", "regular", "cambio"], labels = ["Bien", "Regular", "Cambio"] }) {
  return (
    <section className="break-inside-avoid">
      <h3 className="mb-[2px] text-[8px] font-black text-slate-900">{title}</h3>
      <table className="w-full border-collapse text-[7px] leading-[1.02]">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-400 px-[2px] py-[1px] text-left">Elemento</th>
            {labels.map((l) => (
              <th key={l} className="w-[32px] border border-slate-400 px-[2px] py-[1px] text-center">{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="border border-slate-400 px-[2px] py-[1px]">{r.label}</td>
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
  ["embrague_liquido", "Embrague"],
  ["servo_liquido", "Servodirección"],
  ["limpiap_liquido", "Limpiaparabrisas"],
];

const BLOQUES = [
  { title: "Neumáticos", keys: [["neuma_di", "DI"], ["neuma_dd", "DD"], ["neuma_ti", "TI"], ["neuma_td", "TD"]], obs: "obs_neumaticos" },
  { title: "Frenos", keys: [["frenos_discos", "Discos"], ["frenos_pastillas", "Pastillas"], ["frenos_racores", "Racores"], ["freno_est", "Freno est."]], obs: "obs_frenos" },
  { title: "Limpiaparabrisas", keys: [["limpia_func", "Funcionamiento"], ["limpia_escobillas_di", "Escobillas DI"], ["limpia_escobillas_dd", "Escobillas DD"], ["limpia_escobillas_trasera", "Escobilla tras."], ["limpia_surt_di", "Surtidor DI"], ["limpia_surt_dd", "Surtidor DD"], ["limpia_surt_tr", "Surtidor tras."]], obs: "obs_limpiaparabrisas" },
  { title: "Bombillas", keys: [["bombillas_estado", "Estado general"]], obs: "obs_bombillas", values: ["bien", "mal"], labels: ["Bien", "Mal"] },
  { title: "Otros elementos", keys: [["otros_rotulas", "Guardap. rótulas"], ["otros_fuelles", "Fuelles transm."], ["otros_amort", "Amortiguadores"], ["otros_escape", "Línea escape"], ["otros_tanque", "Tanque comb."], ["otros_cubre", "Cubre bajos"]], obs: "obs_otros" },
];

export default function ChecklistImprimible({ datos = {}, onBack }) {
  const rows = (pairs) => pairs.map(([key, label]) => ({ key, label, value: datos[key] }));

  return (
    <main className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        .print-box { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; max-height: 30px; overflow: hidden; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4 portrait; margin: 4mm; }
          .print-sheet { box-shadow: none !important; width: 100% !important; height: 289mm !important; padding: 0 !important; overflow: hidden !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[820px] flex-col gap-2 sm:flex-row sm:justify-between">
        <button onClick={onBack} className="rounded bg-gray-600 px-4 py-2 font-semibold text-white">← Volver a checklist</button>
        <button onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div className="print-sheet mx-auto w-[794px] bg-white p-3 shadow-xl text-slate-900">
        <header className="mb-1 border-b-[3px] border-red-500 pb-1">
          <div className="grid grid-cols-[80px_1fr_130px] items-center gap-2">
            <img src={LOGO_TOYOTA} alt="Toyota" className="h-10 w-auto object-contain" />
            <h1 className="text-[15px] font-black leading-4 tracking-tight text-slate-800">CHECKLIST VEHÍCULO</h1>
            <div className="text-right"><p className="text-[9px] font-black leading-tight">CALENDA AUTOMOCIÓN</p><p className="text-[7px] font-bold">HIGUERA LA REAL</p></div>
          </div>
        </header>

        <section className="mb-1">
          <h2 className="mb-[2px] text-[9px] font-black">Datos del VH</h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-[2px]">
            <FieldLine label="Matrícula:" value={datos.matricula} />
            <FieldLine label="Nº OR:" value={datos.numeroOR} />
            <FieldLine label="Modelo:" value={datos.marcaModelo} />
            <FieldLine label="Fecha cita:" value={datos.fechaCita} />
            <FieldLine label="Cliente:" value={datos.nombreCliente} />
            <FieldLine label="Teléfono:" value={datos.telefonoCliente} />
            <FieldLine label="Asesor:" value={datos.asesor} />
            <FieldLine label="Diagnosticador:" value={datos.diagnosticador} />
          </div>
        </section>

        <section className="mb-1 border border-blue-200 bg-blue-50 p-1">
          <h2 className="mb-[2px] text-[9px] font-black text-blue-900">Recepción activa</h2>
          <div className="grid grid-cols-2 gap-x-2 gap-y-[2px] text-[7px]">
            <FieldLine label="Km:" value={datos.recepcionKilometraje} />
            <FieldLine label="Combustible:" value={datos.recepcionNivelCombustible} />
            <FieldLine label="A/A:" value={datos.recepcionAireAcondicionado} />
            <FieldLine label="Alfombrillas:" value={datos.recepcionAlfombrillasEstado} />
            <FieldLine label="Obs. alfombrillas:" value={datos.recepcionAlfombrillasObservaciones} className="col-span-2" />
            <FieldLine label="Neum. DD:" value={datos.recepcionNeumaticoDelanteroDerecho} />
            <FieldLine label="Neum. DI:" value={datos.recepcionNeumaticoDelanteroIzquierdo} />
            <FieldLine label="Neum. TD:" value={datos.recepcionNeumaticoTraseroDerecho} />
            <FieldLine label="Neum. TI:" value={datos.recepcionNeumaticoTraseroIzquierdo} />
            <FieldLine label="Limpiabrisas:" value={datos.recepcionLimpiabrisasEstado} className="col-span-2" />
          </div>
        </section>

        <section className="mb-1 grid grid-cols-[1fr_1fr] gap-2">
          <ReviewTable title="Niveles de líquidos" rows={rows(LIQUIDOS)} />
          <section className="break-inside-avoid">
            <h3 className="mb-[2px] text-[8px] font-black text-slate-900">Inspección de fugas</h3>
            <table className="w-full border-collapse text-[7px]">
              <thead><tr className="bg-slate-100"><th className="border border-slate-400 px-[2px] py-[1px] text-left">Elemento</th><th className="border border-slate-400 px-[2px] py-[1px] text-center">Sí</th><th className="border border-slate-400 px-[2px] py-[1px] text-center">No</th></tr></thead>
              <tbody><tr><td className="border border-slate-400 px-[2px] py-[1px]">Fugas</td><CheckCell active={datos.inspeccion_fugas === "si"} /><CheckCell active={datos.inspeccion_fugas === "no"} /></tr></tbody>
            </table>
            <FieldLine label="Obs. líquidos:" value={datos.obs_liquidos} className="mt-1" />
          </section>
        </section>

        <section className="grid grid-cols-2 gap-x-2 gap-y-1">
          {BLOQUES.map((b) => (
            <div key={b.title} className="break-inside-avoid">
              <ReviewTable title={b.title} rows={rows(b.keys)} values={b.values || ["bien", "regular", "cambio"]} labels={b.labels || ["Bien", "Regular", "Cambio"]} />
              <FieldLine label="Obs.:" value={datos[b.obs]} className="mt-[2px]" />
            </div>
          ))}
        </section>

        <section className="mt-1 grid grid-cols-2 gap-1 border-t border-slate-300 pt-1">
          <FieldLine label="Batería:" value={datos.bateria} />
          <FieldLine label="Obs. batería:" value={datos.obs_bateria} />
          <FieldLine label="Recambios:" value={datos.recambios} className="col-span-2" />
          <FieldLine label="Asesores:" value={datos.asesores} className="col-span-2" />
          <FieldLine label="Obs. testigos/mensajes:" value={datos.obs_testigos_mensajes} className="col-span-2" />
        </section>
      </div>
    </main>
  );
}
