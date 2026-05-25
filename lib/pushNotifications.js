"use client";

import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { db, firebaseApp } from "./firebase";

function pushError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

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
    throw pushError("not-supported", "Este navegador o dispositivo no soporta notificaciones push web.");
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
  if (typeof Notification === "undefined") {
    throw pushError("notification-api-missing", "Este navegador no permite pedir permisos de notificaciones.");
  }

  let permission = Notification.permission;
  if (permission !== "granted") {
    if (!requestPermission) return null;
    permission = await Notification.requestPermission();
  }
  if (permission === "denied") {
    throw pushError("permission-denied", "El permiso de notificaciones está bloqueado en el navegador.");
  }
  if (permission !== "granted") {
    throw pushError("permission-not-granted", "No se ha concedido el permiso de notificaciones.");
  }

  // Registrar SW (necesario para background)
  let swReg;
  try {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  } catch (e) {
    console.error("Error registrando Service Worker:", e);
    throw pushError("service-worker-error", "No se ha podido registrar el servicio de notificaciones del navegador.");
  }

  // Obtener token
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw pushError("missing-vapid-key", "Falta configurar NEXT_PUBLIC_FIREBASE_VAPID_KEY en Vercel.");
  }

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: swReg,
  }).catch((e) => {
    console.error("Error obteniendo token FCM:", e);
    return null;
  });

  if (!token) {
    throw pushError("token-error", "Firebase no ha devuelto token de notificaciones para este navegador.");
  }

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
