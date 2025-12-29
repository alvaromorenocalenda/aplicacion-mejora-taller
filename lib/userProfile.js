// lib/userProfile.js
// Utilidades sencillas para perfiles/roles de usuario.
//
// Estructura recomendada en Firestore:
//   usuarios/{uid} {
//     email: string,
//     nombre: string,
//     rol: 'ADMIN' | 'MECANICO' | 'ASESOR' | ...
//   }
//
// Si el documento no existe, se asume rol 'ADMIN' (ver todo).

import { db } from "./firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

export async function getUserProfile(uid) {
  if (!uid) return { rol: "ADMIN" };
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (!snap.exists()) return { rol: "ADMIN" };
  const data = snap.data() || {};
  return { ...data, rol: (data.rol || "ADMIN").toUpperCase() };
}

export function subscribeUserProfile(uid, cb) {
  if (!uid) {
    cb({ rol: "ADMIN" });
    return () => {};
  }
  return onSnapshot(
    doc(db, "usuarios", uid),
    (snap) => {
      if (!snap.exists()) cb({ rol: "ADMIN" });
      else {
        const data = snap.data() || {};
        cb({ ...data, rol: (data.rol || "ADMIN").toUpperCase() });
      }
    },
    () => cb({ rol: "ADMIN" })
  );
}

// Devuelve una lista de mecánicos (usuarios con rol MECANICO).
export async function listMecanicos() {
  const q = query(collection(db, "usuarios"), where("rol", "==", "MECANICO"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
}
