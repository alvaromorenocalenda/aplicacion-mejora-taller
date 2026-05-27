"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ChecklistPrintButtonInjector() {
  const pathname = usePathname();

  useEffect(() => {
    const partes = (pathname || "").split("/").filter(Boolean);
    const esChecklist = partes[0] === "diagnostico-form" && partes[1] && partes[2] !== "imprimible";
    const id = esChecklist ? partes[1] : "";

    document.querySelectorAll(".js-checklist-print-injected").forEach((el) => el.remove());
    document.documentElement.classList.toggle("diagnostico-edit-page", esChecklist && partes[2] !== "detalle");

    if (!esChecklist || !id) return;

    const addButton = () => {
      if (document.querySelector(".js-checklist-print-injected")) return true;

      const buttons = Array.from(document.querySelectorAll("main button, main a"));
      const volver = buttons.find((b) => (b.textContent || "").trim().toLowerCase() === "volver");
      if (!volver || !volver.parentElement) return false;

      const a = document.createElement("a");
      a.href = `/diagnostico-form/${encodeURIComponent(id)}/imprimible`;
      a.textContent = "🖨️ Versión imprimible";
      a.className = "js-checklist-print-injected px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-semibold inline-flex items-center justify-center";
      volver.insertAdjacentElement("beforebegin", a);

      const parent = volver.parentElement;
      parent.classList.add("flex", "gap-3", "items-center", "flex-wrap");
      return true;
    };

    if (addButton()) return;
    const timer = window.setInterval(() => {
      if (addButton()) window.clearInterval(timer);
    }, 200);

    return () => window.clearInterval(timer);
  }, [pathname]);

  return (
    <style jsx global>{`
      @media print {
        .js-checklist-print-injected { display: none !important; }
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:first-child > div:first-child {
        align-items: center !important;
        gap: 12px !important;
        margin-bottom: 12px !important;
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:first-child > div:first-child img {
        height: 58px !important;
        max-width: 110px !important;
        object-fit: contain !important;
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:first-child > div:first-child span {
        font-size: 18px !important;
        line-height: 1.1 !important;
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:first-child > div:first-child > div:last-child {
        font-size: 14px !important;
        line-height: 1.2 !important;
      }
    `}</style>
  );
}
