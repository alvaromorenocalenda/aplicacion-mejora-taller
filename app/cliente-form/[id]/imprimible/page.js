"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import CuestionarioImprimible from "@/components/CuestionarioImprimible";

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

  return (
    <CuestionarioImprimible
      datos={datos}
      onBack={() => router.push(`/cliente-form/${encodeURIComponent(id)}?edit=true`)}
    />
  );
}
