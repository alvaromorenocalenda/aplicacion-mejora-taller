"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";
import BrandLogos, { LOGO_TALLERES_CALENDA } from "../../components/BrandLogos";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch {
      setError("Email o contraseña incorrectos");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50 to-red-50 p-4 sm:p-6">
      <div className="absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(circle at 18% 20%, rgba(239,68,68,.18), transparent 28rem), radial-gradient(circle at 84% 12%, rgba(37,99,235,.20), transparent 30rem), linear-gradient(135deg, rgba(255,255,255,.92), rgba(239,246,255,.72))" }} />
      <div className="absolute left-0 top-0 h-72 w-72 rounded-full bg-red-200/30 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />

      <div className="relative w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/55 p-6 sm:p-8 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-4">
            <img src={LOGO_TALLERES_CALENDA} alt="Talleres Calenda" className="h-20 w-auto rounded-2xl bg-white object-contain p-2 shadow" />
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-blue-800 font-black">Gestión de taller</p>
              <p className="text-sm font-semibold text-slate-500">Talleres Calenda · Grupo Calenda · Toyota</p>
            </div>
          </div>

          <div>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black leading-tight !text-slate-950 drop-shadow-sm">Aplicación Mejora Taller</h1>
            <p className="mt-4 max-w-xl text-slate-700 text-lg leading-relaxed">Diagnósticos, recambios, agenda de mecánicos, imágenes y chats en un único panel interno.</p>
          </div>

          <BrandLogos />
        </section>

        <section className="w-full max-w-md lg:ml-auto bg-white/95 rounded-3xl shadow-2xl border border-white/80 overflow-hidden backdrop-blur p-6 sm:p-8">
          <div className="mb-6 text-center">
            <img src={LOGO_TALLERES_CALENDA} alt="Talleres Calenda" className="mx-auto mb-4 h-24 w-auto rounded-2xl bg-white object-contain p-2 shadow-md" />
            <h2 className="text-3xl font-extrabold text-gray-900">Iniciar sesión</h2>
            <p className="text-sm text-gray-500 mt-1">Acceso interno del taller</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="tú@correo.com" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-blue-700 text-white py-3 rounded-xl font-black hover:from-red-700 hover:to-blue-800 transition shadow-lg">
              Entrar
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-center border">
            <p className="text-xs text-gray-500">Talleres Calenda · Grupo Calenda · Toyota</p>
          </div>
        </section>
      </div>
    </main>
  );
}
