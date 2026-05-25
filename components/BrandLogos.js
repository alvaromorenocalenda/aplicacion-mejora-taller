"use client";

function LogoTalleresCalenda() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow border border-white/70">
      <div className="relative h-12 w-16 shrink-0">
        <div className="absolute left-1 top-5 h-5 w-14 rounded-full bg-red-600 shadow-md" />
        <div className="absolute left-7 top-2 h-7 w-9 rounded-t-full bg-red-500 shadow" />
        <div className="absolute left-4 top-9 h-3 w-3 rounded-full bg-slate-950 ring-2 ring-white" />
        <div className="absolute right-1 top-9 h-3 w-3 rounded-full bg-slate-950 ring-2 ring-white" />
        <div className="absolute left-2 top-0 h-12 w-16 rounded-full border-[5px] border-slate-950 border-b-transparent border-r-transparent rotate-[-12deg] opacity-90" />
      </div>
      <div className="leading-none">
        <p className="text-xs font-black tracking-[0.22em] text-slate-900">TALLERES</p>
        <p className="text-2xl font-black tracking-tight text-red-600">CALENDA</p>
      </div>
    </div>
  );
}

function LogoGrupoCalenda() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow border border-white/70">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-700 to-red-500 text-white shadow-lg">
        <span className="font-serif text-2xl font-black tracking-tighter">CA</span>
      </div>
      <div className="leading-tight">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Grupo</p>
        <p className="text-lg font-black text-slate-900">Calenda</p>
      </div>
    </div>
  );
}

function LogoToyota() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow border border-white/70">
      <div className="relative h-12 w-16 shrink-0">
        <div className="absolute inset-x-1 top-2 h-8 rounded-full border-4 border-slate-400" />
        <div className="absolute left-5 top-1 h-10 w-7 rounded-full border-4 border-slate-400" />
        <div className="absolute left-2 right-2 top-4 h-4 rounded-full border-4 border-slate-400" />
      </div>
      <p className="text-2xl font-black tracking-tight text-red-600">TOYOTA</p>
    </div>
  );
}

export default function BrandLogos({ compact = false }) {
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 md:grid-cols-3"}`}>
      <LogoTalleresCalenda />
      <LogoGrupoCalenda />
      <LogoToyota />
    </div>
  );
}
