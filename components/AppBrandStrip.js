"use client";

import { usePathname } from "next/navigation";

export default function AppBrandStrip() {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return null;

  return (
    <div className="no-print sticky top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-blue-700 text-white shadow-md">
            <span className="text-sm font-black">TC</span>
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-black text-slate-900">Talleres Calenda</p>
            <p className="truncate text-xs text-slate-500">Gestión interna de taller</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-100">Grupo Calenda</div>
          <div className="rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">Toyota</div>
        </div>
      </div>
    </div>
  );
}
