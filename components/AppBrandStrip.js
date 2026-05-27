"use client";

import { usePathname } from "next/navigation";
import { LOGO_TALLERES_CALENDA, LOGO_GRUPO_CALENDA, LOGO_TOYOTA } from "./BrandLogos";
import GlobalSearchBar from "./GlobalSearchBar";

export default function AppBrandStrip() {
  const pathname = usePathname();
  if (pathname?.startsWith("/login")) return null;

  const partes = (pathname || "").split("/").filter(Boolean);
  const isChecklistTrabajo =
    partes[0] === "diagnostico-form" &&
    partes[1] &&
    partes[1] !== "imprimible" &&
    partes[2] !== "imprimible";
  const checklistId = isChecklistTrabajo ? partes[1] : "";
  const checklistPrintUrl = checklistId ? `/diagnostico-form/${encodeURIComponent(checklistId)}/imprimible` : "";

  return (
    <div className="no-print sticky top-0 z-40 border-b border-white/70 bg-white/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-shrink-0 items-center gap-3 sm:w-auto sm:min-w-[280px]">
          <img src={LOGO_TALLERES_CALENDA} alt="Talleres Calenda" className="h-14 w-auto flex-shrink-0 rounded-lg bg-white object-contain shadow-sm" />
          <div className="leading-tight">
            <p className="whitespace-nowrap text-base font-black text-slate-950 sm:text-lg">Talleres Calenda</p>
            <p className="whitespace-nowrap text-sm font-medium text-slate-600">Gestión interna de taller</p>
          </div>
        </div>

        <div className="order-3 w-full lg:order-2 lg:flex lg:justify-center">
          <GlobalSearchBar />
        </div>

        <div className="order-2 flex items-center gap-3 lg:order-3">
          {isChecklistTrabajo ? (
            <a
              href={checklistPrintUrl}
              className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white shadow hover:bg-blue-800"
            >
              🖨️ Versión imprimible
            </a>
          ) : null}
          <div className="hidden items-center gap-3 sm:flex">
            <img src={LOGO_GRUPO_CALENDA} alt="Grupo Calenda" className="h-10 w-10 rounded-full object-contain shadow-sm" />
            <img src={LOGO_TOYOTA} alt="Toyota" className="h-10 w-auto rounded-lg bg-white object-contain px-2 py-1 shadow-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
