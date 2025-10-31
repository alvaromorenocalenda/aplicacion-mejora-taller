// app/cliente-form/[id]/page.js
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// **Lista completa de campos** (tienes que ajustar etiquetas / nombres si cambian)
const ALL_FIELDS = [
  "numero_orden",
  "nombre",
  "telefono",
  "matricula",
  "marca_modelo",
  "kms",
  "fecha",
  "descripcion_sintoma_cliente",
  "testigos_mensajes_cuadro",
  // … aquí añade todos los names que usas en tu form …
  "tipo",
  "tipo_otro",
  "categoria",
  "categoria_otro",
  "en_que_parte_ocurre",
  "desde_cuando",
  "desde_cuando_otro",
  "frecuencia",
  "frecuencia_otro",
  "donde_ocurre",
  "donde_ocurre_otro",
  "condiciones_exteriores",
  "condiciones_exteriores_otro",
  "como_ocurre",
  "posicion_cambio_valor",
  "velocidad_kmh_valor",
  "revoluciones_rpm_valor",
  "como_ocurre_otro",
  "observaciones",
];

export default function ClienteDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const pdfRef = useRef();

  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    if (!id) {
      router.replace("/dashboard");
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "trabajos", id));
        if (!snap.exists()) {
          router.replace("/dashboard");
          return;
        }
        const d = snap.data();
        setDocData({
          cliente: d.cliente,
          creadoEn: d.creadoEn.toDate().toLocaleString(),
        });
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando…</p>;
  if (!docData) return null;

  const { cliente, creadoEn } = docData;

  const generatePdf = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentW = pageW - margin * 2;
    const contentH = pageH - margin * 2;

    const { width: iw, height: ih } = pdf.getImageProperties(imgData);
    const imgW = contentW;
    const imgH = (ih * imgW) / iw;
    const pages = Math.ceil(imgH / contentH);

    for (let i = 0; i < pages; i++) {
      pdf.addImage(imgData, "PNG", margin, margin - contentH * i, imgW, imgH);
      if (i < pages - 1) pdf.addPage();
    }

    const safeMat = cliente.matricula?.replace(/[^a-zA-Z0-9]/g, "_") ?? "sinMat";
    const safeNom = cliente.nombre?.replace(/[^a-zA-Z0-9]/g, "_") ?? "sinNom";
    pdf.save(`Cuestionario_${safeMat}_${safeNom}.pdf`);
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-center">Detalle del Cuestionario</h1>

      <div ref={pdfRef} className="bg-white p-6 rounded-lg shadow space-y-4">
        <style jsx>{`
          .print-row {
            page-break-inside: avoid;
          }
        `}</style>

        {ALL_FIELDS.map((key) => {
          const val = cliente[key];
          // si es array (checkbox), muestro lista
          const display = Array.isArray(val) ? val.join(", ") : val ?? "";
          // ocultar 'otro' si no marca Otro
          if (key.endsWith("_otro")) {
            const base = key.replace("_otro", "");
            if (!Array.isArray(cliente[base]) || !cliente[base].includes("Otro")) {
              return null;
            }
          }
          // ocultar valores numéricos de como_ocurre si no seleccionó
          if (key === "posicion_cambio_valor" && !cliente.como_ocurre?.includes("Posición cambio")) return null;
          if (key === "velocidad_kmh_valor" && !cliente.como_ocurre?.includes("Velocidad km/h")) return null;
          if (key === "revoluciones_rpm_valor" && !cliente.como_ocurre?.includes("Revoluciones rpm")) return null;

          return (
            <div key={key} className="print-row">
              <label className="block font-medium mb-1">
                {
                  {
                    numero_orden: "Nº OR",
                    nombre: "Nombre y apellidos",
                    telefono: "Teléfono",
                    matricula: "Matrícula",
                    marca_modelo: "Marca/Modelo",
                    kms: "Kilómetros actuales",
                    fecha: "Fecha Cita",
                    descripcion_sintoma_cliente: "Descripción síntoma",
                    testigos_mensajes_cuadro: "Testigos/mensajes cuadro",
                    sep_detalles: "Detalles del síntoma",
                    tipo: "Tipo",
                    tipo_otro: "Tipo - otro detalle",
                    categoria: "Categoría",
                    categoria_otro: "Categoría - otro detalle",
                    en_que_parte_ocurre: "Parte vehículo",
                    desde_cuando: "Desde cuándo",
                    desde_cuando_otro: "Desde cuándo - otro",
                    frecuencia: "Frecuencia",
                    frecuencia_otro: "Frecuencia - otro",
                    donde_ocurre: "Dónde ocurre",
                    donde_ocurre_otro: "Dónde ocurre - otro",
                    condiciones_exteriores: "Condiciones exteriores",
                    condiciones_exteriores_otro: "Condiciones - otro",
                    como_ocurre: "Cómo ocurre",
                    posicion_cambio_valor: "Posición cambio",
                    velocidad_kmh_valor: "Velocidad km/h",
                    revoluciones_rpm_valor: "Revoluciones rpm",
                    como_ocurre_otro: "Cómo ocurre - otro",
                    observaciones: "Observaciones adicionales",
                  }[key] || key
                }
              </label>
              {typeof display === "string" && display.length > 60 ? (
                <textarea
                  readOnly
                  value={display}
                  rows={3}
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              ) : (
                <input
                  readOnly
                  value={display}
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                />
              )}
            </div>
          );
        })}

        <p className="text-sm text-gray-500">Creado: {creadoEn}</p>
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          Volver
        </button>
        <button
          onClick={generatePdf}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Descargar PDF
        </button>
      </div>
    </main>
  );
}
