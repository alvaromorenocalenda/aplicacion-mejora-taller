"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const asText = (v) => {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "";
  if (v === null || v === undefined) return "";
  return String(v);
};

function Row({ label, value }) {
  return (
    <div className="border border-gray-300 p-2 min-h-[42px]">
      <p className="text-[11px] font-bold text-gray-500 uppercase">{label}</p>
      <p className="text-sm font-semibold text-gray-900 whitespace-pre-wrap">{asText(value) || "—"}</p>
    </div>
  );
}

function CheckLine({ label, value }) {
  return (
    <div className="flex items-start gap-2 border-b border-gray-200 py-1 text-sm">
      <span className="mt-0.5 inline-flex h-4 w-4 items-center justify-center border border-gray-500 text-[10px]">{value ? "✓" : ""}</span>
      <span>{label}</span>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <section className="border border-gray-300 rounded overflow-hidden bg-white">
      <h2 className="bg-gray-100 px-3 py-2 text-sm font-black text-gray-900 border-b border-gray-300">{title}</h2>
      <div className="p-3">{children}</div>
    </section>
  );
}

export default function CuestionarioImprimiblePage() {
  const params = useParams();
  const id = decodeURIComponent(params.id);
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }
    async function cargar() {
      const snap = await getDoc(doc(db, "cuestionarios_cliente", id));
      if (!snap.exists()) {
        router.replace("/dashboard");
        return;
      }
      const d = (snap.data() || {}).datos || {};
      setDatos(d);
      try {
        document.title = `Imprimible - ${d.matricula || ""} - ${d.numeroOR || ""}`.trim();
      } catch (e) {}
      setLoading(false);
    }
    cargar();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando versión imprimible…</p>;
  if (!datos) return null;

  const tipo = Array.isArray(datos.tipo) ? datos.tipo : [datos.tipo].filter(Boolean);
  const categoria = Array.isArray(datos.categoria) ? datos.categoria : [datos.categoria].filter(Boolean);
  const desde = Array.isArray(datos.desde) ? datos.desde : [datos.desde].filter(Boolean);
  const frecuencia = Array.isArray(datos.frecuencia) ? datos.frecuencia : [datos.frecuencia].filter(Boolean);
  const donde = Array.isArray(datos.donde) ? datos.donde : [datos.donde].filter(Boolean);
  const condiciones = Array.isArray(datos.condiciones) ? datos.condiciones : [datos.condiciones].filter(Boolean);
  const como = Array.isArray(datos.como) ? datos.como : [datos.como].filter(Boolean);

  return (
    <main className="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-col gap-2 sm:flex-row sm:justify-between">
        <button onClick={() => router.push(`/cliente-form/${encodeURIComponent(id)}?edit=true`)} className="rounded bg-gray-600 px-4 py-2 font-semibold text-white">← Volver al cuestionario</button>
        <button onClick={() => window.print()} className="rounded bg-blue-700 px-4 py-2 font-semibold text-white">🖨️ Imprimir / Guardar PDF</button>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-6 shadow print:shadow-none print:p-0">
        <header className="mb-4 flex items-center justify-between border-b-4 border-red-600 pb-3">
          <div>
            <h1 className="text-2xl font-black text-gray-900">CUESTIONARIO DE SÍNTOMAS</h1>
            <p className="font-bold text-gray-600">Calenda Automoción · Higuera la Real</p>
          </div>
          <div className="text-right text-sm font-bold text-red-700">
            <p>Talleres Calenda</p>
            <p>{new Date().toLocaleDateString("es-ES")}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <Row label="Matrícula" value={datos.matricula} />
          <Row label="Nº OR" value={datos.numeroOR} />
          <Row label="Cliente" value={datos.nombreCliente} />
          <Row label="Teléfono" value={datos.telefonoCliente} />
          <Row label="Modelo" value={datos.marcaModelo} />
          <Row label="Ciclo" value={datos.ciclo} />
          <Row label="Fecha cita" value={datos.fechaCita} />
          <Row label="Fecha salida" value={datos.fechaSalida} />
          <Row label="Asesor" value={datos.asesor} />
          <Row label="Mecánico" value={datos.mecanicoNombre} />
        </div>

        <div className="space-y-3">
          <Group title="Descripción del síntoma por el cliente">
            <div className="min-h-[90px] whitespace-pre-wrap rounded border border-gray-300 bg-gray-50 p-3 text-sm">{asText(datos.descripcion) || "—"}</div>
          </Group>

          <Group title="Testigos y mensajes del cuadro">
            <div className="grid grid-cols-2 gap-2">
              <Row label="Testigos" value={datos.testigos} />
              <Row label="Mensajes" value={datos.mensajes} />
            </div>
          </Group>

          <Group title="Detalles del síntoma">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-bold mb-1">Tipo</p>
                {["Ruido", "Vibración"].map((x) => <CheckLine key={x} label={x} value={tipo.includes(x)} />)}
                <Row label="Otro" value={datos.tipoOtro} />
              </div>
              <div>
                <p className="font-bold mb-1">Categoría</p>
                {["Motor", "Chasis", "Electrónica", "Dirección", "Frenos", "SistemaHibrido"].map((x) => <CheckLine key={x} label={x} value={categoria.includes(x)} />)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Row label="Comentarios" value={datos.comentarios} />
              <Row label="Parte del coche" value={datos.parteCoche} />
            </div>
          </Group>

          <Group title="Condiciones del síntoma">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-bold mb-1">¿Desde cuándo?</p>
                {["1 día o menos", "> 1 semana"].map((x) => <CheckLine key={x} label={x} value={desde.includes(x)} />)}
                <Row label="Otro" value={datos.desdeOtro} />
              </div>
              <div>
                <p className="font-bold mb-1">¿Con qué frecuencia?</p>
                {["1 vez al día", "Ocasionalmente", "Siempre"].map((x) => <CheckLine key={x} label={x} value={frecuencia.includes(x)} />)}
                <Row label="Otro" value={datos.frecuenciaOtro} />
              </div>
              <div>
                <p className="font-bold mb-1">¿Dónde ocurre?</p>
                {["Nacional", "Autopista", "Ciudad", "Adoquines", "Tierra", "Baches"].map((x) => <CheckLine key={x} label={x} value={donde.includes(x)} />)}
                <Row label="Otro" value={datos.dondeOtro} />
              </div>
              <div>
                <p className="font-bold mb-1">Condiciones exteriores</p>
                {["Mojado", "Seco", "Viento", "VehiculoFrio", "VehiculoCaliente"].map((x) => <CheckLine key={x} label={x} value={condiciones.includes(x)} />)}
                <Row label="Otro" value={datos.condicionesOtro} />
              </div>
            </div>
          </Group>

          <Group title="¿Cómo ocurre?">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
              {["Aparcando", "Acelerando", "Ralenti", "CambioMarcha", "Reteniendo", "EnRecta", "Remolque", "MuyCargado", "Seco", "CurvasIzq", "CurvasDer"].map((x) => <CheckLine key={x} label={x} value={como.includes(x)} />)}
            </div>
          </Group>

          <Group title="Datos de conducción">
            <div className="grid grid-cols-3 gap-2">
              <Row label="Posición cambio" value={datos.posicionCambio} />
              <Row label="Velocidad" value={datos.velocidad} />
              <Row label="Revoluciones" value={datos.revoluciones} />
            </div>
          </Group>

          <Group title="Recepción activa del vehículo">
            <div className="grid grid-cols-2 gap-2">
              <Row label="Kilometraje" value={datos.recepcionKilometraje} />
              <Row label="Nivel combustible" value={datos.recepcionNivelCombustible} />
              <Row label="A/A enfría" value={datos.recepcionAireAcondicionado} />
              <Row label="Estado alfombrillas" value={datos.recepcionAlfombrillasEstado} />
              <Row label="Obs. alfombrillas" value={datos.recepcionAlfombrillasObservaciones} />
              <Row label="Limpiabrisas" value={datos.recepcionLimpiabrisasEstado} />
              <Row label="Neumático DD" value={datos.recepcionNeumaticoDelanteroDerecho} />
              <Row label="Neumático DI" value={datos.recepcionNeumaticoDelanteroIzquierdo} />
              <Row label="Neumático TD" value={datos.recepcionNeumaticoTraseroDerecho} />
              <Row label="Neumático TI" value={datos.recepcionNeumaticoTraseroIzquierdo} />
            </div>
          </Group>

          <Group title="Observaciones finales">
            <div className="min-h-[70px] whitespace-pre-wrap rounded border border-gray-300 bg-gray-50 p-3 text-sm">{asText(datos.otroLibre) || "—"}</div>
          </Group>
        </div>
      </div>
    </main>
  );
}
