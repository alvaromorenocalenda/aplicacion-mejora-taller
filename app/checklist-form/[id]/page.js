"use client";

import { useParams } from "next/navigation";
import ChecklistForm from "@/components/ChecklistForm";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import VehicleImages from "@/components/VehicleImages";

export default function ChecklistEditPage() {
  const params = useParams();
  const id = decodeURIComponent(params.id);
const [item, setItem] = useState(null);

  useEffect(() => {
    (async () => {
      const ref = doc(db, "checklists", id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setItem({ id: snap.id, ...snap.data() });
      }
    })();
  }, [id]);

  if (!item) return <p className="p-6">Cargando datos del checklist...</p>;

  return (
    <>
      <div className="p-6 pb-0">
        <VehicleImages
          checklistId={id}
          cuestionarioId={item.cuestionarioId}
          matricula={item.datos?.matricula || item.matricula}
          numeroOR={item.datos?.numeroOR || item.numeroOR}
          compact
        />
      </div>
      <ChecklistForm item={item} onClose={() => history.back()} />
    </>
  );
}
