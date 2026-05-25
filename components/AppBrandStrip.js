"use client";

import { usePathname } from "next/navigation";
import { LOGO_TALLERES_CALENDA, LOGO_GRUPO_CALENDA, LOGO_TOYOTA } from "./BrandLogos";

export default function AppBrandStrip() {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return null;

  return (
    <div className="no-print sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <img src={LOGO_TALLERES_CALENDA} alt="Talleres Calenda" className="h-12 w-auto rounded-lg bg-white object-contain shadow-sm" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-black text-slate-900">Talleres Calenda</p>
            <p className="truncate text-xs text-slate-500">Gestión interna de taller</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <img src={LOGO_GRUPO_CALENDA} alt="Grupo Calenda" className="h-10 w-10 rounded-full object-contain shadow-sm" />
          <img src={LOGO_TOYOTA} alt="Toyota" className="h-10 w-auto rounded-lg bg-white object-contain px-2 py-1 shadow-sm" />
        </div>
      </div>
    </div>
  );
}
