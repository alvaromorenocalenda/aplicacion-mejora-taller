"use client";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { db, firebaseApp } from "./firebase";

/**
 * Registra el navegador para notificaciones Push (FCM Web).
 * - Pide permiso
 * - Registra service worker (/firebase-messaging-sw.js)
 * - Guarda el token en Firestore: users/{uid}/fcmTokens/{token}
 */
export async function registerPushForUser(uid, extraUserData = {}) {
  if (!uid) return;

  const supported = await isSupported().catch(() => false);
  if (!supported) return;

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
  if (typeof Notification === "undefined") return;

  let permission = Notification.permission;
  if (permission !== "granted") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  // Registrar SW
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  // Obtener token
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("Falta NEXT_PUBLIC_FIREBASE_VAPID_KEY en variables de entorno.");
    return;
  }

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  });

  if (!token) return;

  // Guardar token (doc id = token)
  await setDoc(
    doc(db, "users", uid, "fcmTokens", token),
    {
      token,
      userAgent: navigator.userAgent,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}
