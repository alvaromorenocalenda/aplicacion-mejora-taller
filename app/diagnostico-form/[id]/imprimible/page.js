"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import ChecklistImprimible from "@/components/ChecklistImprimible";

export default function ChecklistImprimiblePage() {
  const params = useParams();
  const id = params?.id ? decodeURIComponent(params.id) : "";
  const router = useRouter();
  const [datos, setDatos] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    if (!auth.currentUser) {
      router.replace("/login");
      return;
    }

    async function cargar() {
      const snapChecklist = await getDoc(doc(db, "checklists", id));
      if (!snapChecklist.exists()) {
        router.replace("/diagnostico-form");
        return;
      }

      const checklistDoc = snapChecklist.data() || {};
      const datosChecklist = checklistDoc.datos || {};
      let datosCuestionario = {};

      if (checklistDoc.cuestionarioId) {
        const snapCuest = await getDoc(doc(db, "cuestionarios_cliente", checklistDoc.cuestionarioId));
        if (snapCuest.exists()) datosCuestionario = (snapCuest.data() || {}).datos || {};
      }

      const datosCombinados = { ...datosCuestionario, ...datosChecklist };
      setDatos(datosCombinados);
      try {
        document.title = `Checklist imprimible - ${datosCombinados.matricula || ""} - ${datosCombinados.numeroOR || ""}`.trim();
      } catch (e) {}
      setLoading(false);
    }

    cargar();
  }, [id, router]);

  if (loading) return <p className="p-6 text-center">Cargando versión imprimible…</p>;
  if (!datos) return null;

  return (
    <ChecklistImprimible
      datos={datos}
      onBack={() => router.push(`/diagnostico-form/${encodeURIComponent(id)}/detalle`)}
    />
  );
}
