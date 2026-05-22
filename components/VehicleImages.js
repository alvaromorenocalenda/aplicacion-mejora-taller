"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, listAll, ref } from "firebase/storage";
import { db, storage } from "@/lib/firebase";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function uniqueImages(images) {
  const seen = new Set();
  return images.filter((img) => {
    const key = img.rutaStorage || img.name || img.nombreArchivo || img.url;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function buscarDatosCuestionario(cuestionarioId) {
  if (!cuestionarioId) return {};

  try {
    const snap = await getDoc(doc(db, "cuestionarios_cliente", cuestionarioId));
    if (!snap.exists()) return {};
    return (snap.data() || {}).datos || {};
  } catch (error) {
    console.error("Error obteniendo datos del cuestionario para imágenes:", error);
    return {};
  }
}

async function buscarImagenesVehiculo({ checklistId, cuestionarioId, matricula, numeroOR }) {
  const datosCuestionario = await buscarDatosCuestionario(cuestionarioId);
  const matriculaFinal = matricula || datosCuestionario.matricula || "";
  const numeroORFinal = numeroOR || datosCuestionario.numeroOR || "";

  const matNorm = normalizeText(matriculaFinal);
  const orNorm = normalizeText(numeroORFinal);
  const resultados = [];

  // 1) Búsqueda por asociación guardada en Firestore.
  try {
    if (checklistId) {
      const qChecklist = query(
        collection(db, "imagenes_vehiculo"),
        where("checklistId", "==", checklistId)
      );
      const snapChecklist = await getDocs(qChecklist);
      snapChecklist.forEach((docSnap) => {
        const img = docSnap.data() || {};
        if (img.url) resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
      });
    }
  } catch (error) {
    console.error("Error buscando imágenes por checklistId:", error);
  }

  try {
    if (cuestionarioId) {
      const qCuestionario = query(
        collection(db, "imagenes_vehiculo"),
        where("cuestionarioId", "==", cuestionarioId)
      );
      const snapCuestionario = await getDocs(qCuestionario);
      snapCuestionario.forEach((docSnap) => {
        const img = docSnap.data() || {};
        if (img.url) resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
      });
    }
  } catch (error) {
    console.error("Error buscando imágenes por cuestionarioId:", error);
  }

  try {
    if (matNorm && orNorm) {
      const qMatricula = query(
        collection(db, "imagenes_vehiculo"),
        where("matriculaNormalizada", "==", matNorm)
      );
      const snapMatricula = await getDocs(qMatricula);
      snapMatricula.forEach((docSnap) => {
        const img = docSnap.data() || {};
        if (normalizeText(img.numeroORNormalizado || img.numeroOR) === orNorm && img.url) {
          resultados.push({ ...img, name: img.nombreArchivo || img.rutaStorage || "Imagen" });
        }
      });
    }
  } catch (error) {
    console.error("Error buscando imágenes por matrícula y nº OR:", error);
  }

  // 2) Compatibilidad con fotos antiguas: busca en Storage aunque tengan espacios, guiones, barras o paréntesis.
  try {
    if (matNorm && orNorm) {
      const listRef = ref(storage, "imagenes/");
      const res = await listAll(listRef);
      const antiguas = await Promise.all(
        res.items.map(async (itemRef) => {
          const nombreNormalizado = normalizeText(itemRef.name);
          const coincide = nombreNormalizado.includes(matNorm) && nombreNormalizado.includes(orNorm);
          if (!coincide) return null;

          return {
            url: await getDownloadURL(itemRef),
            name: itemRef.name,
            nombreArchivo: itemRef.name,
            rutaStorage: itemRef.fullPath,
          };
        })
      );
      resultados.push(...antiguas.filter(Boolean));
    }
  } catch (error) {
    console.error("Error buscando imágenes antiguas en Storage:", error);
  }

  return uniqueImages(resultados);
}

export default function VehicleImages({
  checklistId = "",
  cuestionarioId = "",
  matricula = "",
  numeroOR = "",
  title = "Imágenes del vehículo",
  compact = false,
}) {
  const [imagenes, setImagenes] = useState([]);
  const [loading, setLoading] = useState(true);

  const searchKey = useMemo(
    () => JSON.stringify({ checklistId, cuestionarioId, matricula, numeroOR }),
    [checklistId, cuestionarioId, matricula, numeroOR]
  );

  useEffect(() => {
    let active = true;

    async function cargar() {
      setLoading(true);
      try {
        const imgs = await buscarImagenesVehiculo({ checklistId, cuestionarioId, matricula, numeroOR });
        if (active) setImagenes(imgs);
      } catch (error) {
        console.error("Error cargando imágenes del vehículo:", error);
        if (active) setImagenes([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    cargar();
    return () => {
      active = false;
    };
  }, [searchKey]);

  return (
    <section className="border-2 border-red-200 bg-red-50 rounded-lg p-4">
      <h3 className="font-semibold text-lg text-red-900 mb-4">{title}</h3>
      {!loading && imagenes.length > 0 && (
        <div className={compact ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"}>
          {imagenes.map((img, idx) => (
            <div key={`${img.rutaStorage || img.name || img.url}-${idx}`} className="bg-white rounded-lg shadow p-3">
              <img
                src={img.url}
                alt={img.name || img.nombreArchivo || "Imagen del vehículo"}
                className={compact ? "w-full h-40 object-contain rounded border" : "w-full h-52 object-contain rounded border"}
              />
              <button
                type="button"
                onClick={() => window.open(img.url, "_blank")}
                className="mt-2 w-full px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
              >
                Ver imagen
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
