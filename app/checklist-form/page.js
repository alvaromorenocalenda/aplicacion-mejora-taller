"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Si no hay usuario, redirige a login
    if (!auth.currentUser) {
      router.replace("/login");
    }
  }, []);

  // Mientras comprobamos la sesión, no renderizamos nada
  if (!auth.currentUser) return null;

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Bienvenido, {auth.currentUser.email}</p>
    </main>
  );
}
