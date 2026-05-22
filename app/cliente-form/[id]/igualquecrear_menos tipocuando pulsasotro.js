// app/cliente-form/[id]/page.js
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export default function ClienteDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const pdfRef = useRef();
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);

  useEffect(() => {
    if (!auth.currentUser) return router.replace("/login");
    if (!id) return router.replace("/dashboard");

    (async () => {
      try {
        const snap = await getDoc(doc(db, "trabajos", id));
        if (!snap.exists()) return router.replace("/dashboard");
        setDocData(snap.data().cliente);
      } catch {
        router.replace("/dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  if (loading || !docData) return <p className="p-6 text-center">Cargando…</p>;

  // DEFINICIÓN DE TODOS LOS CAMPOS
  const allFields = {
    numero_orden:        { label: "Nº OR", type:"text" },
    nombre:              { label: "Nombre y apellidos", type:"text" },
    telefono:            { label: "Teléfono", type:"text" },
    matricula:           { label: "Matrícula", type:"text" },
    marca_modelo:        { label: "Marca/Modelo", type:"text" },
    kms:                 { label: "Kilómetros actuales", type:"number" },
    fecha:               { label: "Fecha Cita:", type:"date" },
    descripcion_sintoma_cliente: { label: "Descripción del síntoma por el cliente:", type:"textarea" },
    testigos_mensajes_cuadro:    { label: "Testigos/mensajes del cuadro:", type:"textarea" },
    sep_detalles:        { label: "Detalles del síntoma", type:"separator" },
    tipo:                { label: "Tipo", type:"checkbox", options:["Ruido","Vibración","Otro"] },
    categoria:           { label: "Categoría", type:"checkbox", options:["Motor","Chasis","Electrónica","Dirección","Frenos","Sist.Híbrido","Otro"] },
    categoria_otro:      { label: "Si marcaste Otro en Categoría, especifique:", type:"textarea" },
    en_que_parte_ocurre: { label: "¿En qué parte del vehículo ocurren?", type:"text" },

    desde_cuando:        { label: "¿Desde cuándo?", type:"checkbox", options:["1 día o menos",">1 semana","Otro"] },
    desde_cuando_otro:   { label: "Si marcaste Otro en Desde cuándo, especifique:", type:"textarea" },
    frecuencia:          { label: "¿Con qué frecuencia?", type:"checkbox", options:["1 vez al día","Ocasionalmente","Siempre","Otro"] },
    frecuencia_otro:     { label: "Si marcaste Otro en Frecuencia, especifique:", type:"textarea" },
    donde_ocurre:        { label: "¿Dónde ocurre?", type:"checkbox", options:["Nacional","Autopista","Ciudad","Adoquines","Tierra","Baches","Otro"] },
    donde_ocurre_otro:   { label: "Si marcaste Otro en Dónde ocurre, especifique:", type:"textarea" },
    condiciones_exteriores:    { label: "Condiciones exteriores:", type:"checkbox", options:["Mojado","Seco","Viento","Vehículo frío","Vehículo caliente","Otro"] },
    condiciones_exteriores_otro:{ label: "Si marcaste Otro en Condiciones exteriores, especifique:", type:"textarea" },
    como_ocurre:         { label: "¿Cómo ocurre?", type:"checkbox", options:[
                               "Aparcando","Acelerando","Ralentí","Cambio de marcha","Reteniendo",
                               "En recta","Muy cargado","Seco","Curva der.","Curva izq.",
                               "Posición cambio","Velocidad km/h","Revoluciones rpm","Otro"
                             ]},
    posicion_cambio_valor: { label: "Posición cambio", type:"number" },
    velocidad_kmh_valor:   { label: "Velocidad km/h", type:"number" },
    revoluciones_rpm_valor:{ label: "Revoluciones rpm", type:"number" },
    como_ocurre_otro:     { label: "Si marcaste Otro en ¿Cómo ocurre?, especifique:", type:"textarea" },
    observaciones:        { label: "Observaciones adicionales", type:"textarea" },
  };

  // Columnas explícitas
  const leftKeys = [
    "numero_orden","nombre","telefono","matricula","marca_modelo","kms","fecha",
    "descripcion_sintoma_cliente","testigos_mensajes_cuadro","sep_detalles",
    "tipo","categoria","categoria_otro","en_que_parte_ocurre"
  ];
  const rightKeys = [
    "desde_cuando","desde_cuando_otro","frecuencia","frecuencia_otro",
    "donde_ocurre","donde_ocurre_otro","condiciones_exteriores","condiciones_exteriores_otro",
    "como_ocurre","posicion_cambio_valor","velocidad_kmh_valor","revoluciones_rpm_valor",
    "como_ocurre_otro","observaciones"
  ];

  // Función que renderiza un campo según su tipo y lógica
  const renderField = key => {
    const field = allFields[key];
    const val = docData[key] || "";
    // lógica "_otro"
    if (key.endsWith("_otro") && !Array.isArray(docData[key.replace(/_otro$/, "")]) ) return null;
    if (key.endsWith("_otro") && !docData[key.replace(/_otro$/, "")].includes("Otro")) return null;
    // lógica valores numéricos según "como_ocurre"
    if (key === "posicion_cambio_valor" && !docData.como_ocurre.includes("Posición cambio")) return null;
    if (key === "velocidad_kmh_valor"  && !docData.como_ocurre.includes("Velocidad km/h")) return null;
    if (key === "revoluciones_rpm_valor" && !docData.como_ocurre.includes("Revoluciones rpm")) return null;

    if (field.type === "separator") {
      return <h3 key={key} className="text-lg font-semibold border-b pb-1 col-span-2">{field.label}</h3>;
    }
    return (
      <div key={key}>
        <label className="block text-sm font-medium mb-1">{field.label}</label>
        {field.type === "textarea" ? (
          <textarea readOnly value={val} rows={3} className="w-full border rounded px-2 py-1 bg-gray-100"/>
        ) : field.type === "checkbox" ? (
          <div className="flex flex-wrap gap-2">
            {field.options.map(opt => (
              <label key={opt} className="inline-flex items-center">
                <input type="checkbox" readOnly checked={Array.isArray(val)? val.includes(opt): false} className="form-checkbox"/>
                <span className="ml-1">{opt}</span>
              </label>
            ))}
          </div>
        ) : (
          <input readOnly type={field.type} value={val} className="w-full border rounded px-2 py-1 bg-gray-100"/>
        )}
      </div>
    );
  };

  // Generar PDF (misma lógica multipágina)
  const generatePdf = async () => {
    if (!pdfRef.current) return;
    const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p","mm","a4");
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const cw = pw - margin*2;
    const ch = ph - margin*2;
    const { width: iw, height: ih } = pdf.getImageProperties(imgData);
    const imgW = cw;
    const imgH = (ih*imgW)/iw;
    const pages = Math.ceil(imgH/ch);

    for (let i=0; i<pages; i++) {
      pdf.addImage(imgData,"PNG",margin, margin - ch*i, imgW, imgH);
      if (i<pages-1) pdf.addPage();
    }
    const safeMat = docData.matricula.replace(/[^a-zA-Z0-9]/g,"_");
    const safeNom = docData.nombre.replace(/[^a-zA-Z0-9]/g,"_");
    pdf.save(`Cuestionario_${safeMat}_${safeNom}.pdf`);
  };

  return (
    <main className="flex flex-col items-center bg-gray-200 min-h-screen p-6 space-y-6">
      <div ref={pdfRef} className="p-6 w-full max-w-4xl">
        <h2 className="text-2xl font-bold text-center mb-4">Detalle Cuestionario Cliente</h2>
        <div className="grid grid-cols-2 gap-8">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-4">
            {leftKeys.map(renderField)}
          </div>
          {/* COLUMNA DERECHA */}
          <div className="space-y-4">
            {rightKeys.map(renderField)}
          </div>
        </div>
      </div>

      <div className="flex space-x-4">
        <button onClick={() => router.back()} className="bg-gray-500 text-white px-4 py-2 rounded">
          Volver
        </button>
        <button onClick={generatePdf} className="bg-green-600 text-white px-4 py-2 rounded">
          Descargar PDF
        </button>
      </div>
    </main>
  );
}
