"use client";

import { useParams } from "next/navigation";
import ChecklistForm from "@/components/ChecklistForm";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ChecklistEditPage() {
  const { id } = useParams();
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

  return <ChecklistForm item={item} onClose={() => history.back()} />;
}
