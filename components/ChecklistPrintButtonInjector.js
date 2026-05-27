"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function ChecklistPrintButtonInjector() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const partes = (pathname || "").split("/").filter(Boolean);
    const esChecklist = partes[0] === "diagnostico-form" && partes[1] && partes[2] !== "imprimible";
    const esEditarChecklist = esChecklist && partes[2] !== "detalle";
    const id = esChecklist ? partes[1] : "";

    document.querySelectorAll(".js-checklist-print-injected").forEach((el) => el.remove());
    document.documentElement.classList.toggle("diagnostico-edit-page", !!esEditarChecklist);

    if (!esChecklist || !id) return;

    const addButton = () => {
      if (document.querySelector(".js-checklist-print-injected")) return true;

      const buttons = Array.from(document.querySelectorAll("main button, main a"));
      const volver = buttons.find((b) => (b.textContent || "").trim().toLowerCase() === "volver");
      if (!volver || !volver.parentElement) return false;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "🖨️ Versión imprimible";
      btn.className = "js-checklist-print-injected px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800 font-semibold inline-flex items-center justify-center";
      btn.addEventListener("click", () => {
        router.push(`/diagnostico-form/${encodeURIComponent(id)}/imprimible`);
      });
      volver.insertAdjacentElement("beforebegin", btn);

      const parent = volver.parentElement;
      parent.classList.add("flex", "gap-3", "items-center", "flex-wrap");
      return true;
    };

    if (addButton()) return;
    const timer = window.setInterval(() => {
      if (addButton()) window.clearInterval(timer);
    }, 200);

    return () => window.clearInterval(timer);
  }, [pathname, router]);

  return (
    <style jsx global>{`
      @media print {
        .js-checklist-print-injected { display: none !important; }
      }

      /* Pantalla de editar checklist: quitamos el PDF de la derecha */
      html.diagnostico-edit-page form#diagnosticoForm {
        display: block !important;
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:first-child {
        width: 100% !important;
        max-width: 760px !important;
        margin-left: auto !important;
        margin-right: auto !important;
      }

      html.diagnostico-edit-page form#diagnosticoForm > div:nth-child(2) {
        display: none !important;
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
