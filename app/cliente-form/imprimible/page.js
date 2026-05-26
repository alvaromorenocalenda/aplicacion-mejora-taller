"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CuestionarioImprimible from "@/components/CuestionarioImprimible";

export default function CuestionarioNuevoImprimiblePage() {
  const router = useRouter();
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cuestionarioImprimibleBorrador");
      setDatos(raw ? JSON.parse(raw) : {});
    } catch {
      setDatos({});
    }
  }, []);

  if (!datos) return <p className="p-6 text-center">Cargando versión imprimible…</p>;

  return (
    <CuestionarioImprimible
      datos={datos}
      onBack={() => router.push("/cliente-form")}
    />
  );
}
