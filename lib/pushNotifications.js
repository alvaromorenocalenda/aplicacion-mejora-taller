"use client";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { db, firebaseApp } from "./firebase";

/**
 * Registra el navegador para notificaciones Push (FCM Web).
 *
 * - Registra SW (/firebase-messaging-sw.js)
 * - Obtiene token (requiere NEXT_PUBLIC_FIREBASE_VAPID_KEY)
 * - Guarda el token en Firestore: users/{uid}/fcmTokens/{token}
 *
 * Nota:
 * - Si requestPermission=false, NO mostrará el prompt; solo funcionará si el permiso ya está concedido.
 */
export async function registerPushForUser(
  uid,
  extraUserData = {},
  { requestPermission = true } = {}
) {
  if (!uid) return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("FCM no soportado en este navegador/dispositivo.");
    return null;
  }

  // Crear/actualizar doc del usuario (útil para tener colección users).
  await setDoc(
    doc(db, "users", uid),
    {
      ...extraUserData,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Pedir permiso de notificaciones
  if (typeof Notification === "undefined") return null;

  let permission = Notification.permission;
  if (permission !== "granted") {
    if (!requestPermission) return null;
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return null;

  // Registrar SW (necesario para background)
  let swReg;
  try {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    console.error("Error registrando Service Worker:", e);
    return null;
  }

  // Obtener token
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en variables de entorno.");
    return null;
  }

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  }).catch((e) => {
    console.error("Error obteniendo token FCM:", e);
    return null;
  });

  if (!token) return null;

  // Guardar token (doc id = token)
  await setDoc(
    doc(db, "users", uid, "fcmTokens", token),
    {
      uid, // ✅ clave para filtrar bien en Cloud Function
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}
