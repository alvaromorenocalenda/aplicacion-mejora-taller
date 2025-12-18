// lib/chatCleanup.js
// Utilidades para gestionar (y borrar) chats por trabajo en Firestore.

import { collection, deleteDoc, doc, getDocs } from "firebase/firestore";

/**
 * Borra un chat completo de un trabajo (doc raíz + canales + mensajes).
 *
 * Estructura:
 *  chats_trabajos/{cuestionarioId}
 *    /canales/{canalId}
 *      /messages/{messageId}
 *
 * Nota: Firestore no ofrece borrado recursivo desde cliente. Aquí recorremos
 * y eliminamos documentos uno a uno.
 */
export async function deleteChatTrabajo(db, cuestionarioId) {
  const trabajoId = String(cuestionarioId);

  try {
    const canalesRef = collection(db, "chats_trabajos", trabajoId, "canales");
    const canalesSnap = await getDocs(canalesRef);

    for (const canalDoc of canalesSnap.docs) {
      const canalId = canalDoc.id;
      const msgsRef = collection(
        db,
        "chats_trabajos",
        trabajoId,
        "canales",
        canalId,
        "messages"
      );
      const msgsSnap = await getDocs(msgsRef);
      for (const m of msgsSnap.docs) {
        await deleteDoc(doc(db, "chats_trabajos", trabajoId, "canales", canalId, "messages", m.id));
      }
      await deleteDoc(doc(db, "chats_trabajos", trabajoId, "canales", canalId));
    }

    await deleteDoc(doc(db, "chats_trabajos", trabajoId));
  } catch (e) {
    // Si no existe o no hay permisos, no bloqueamos el resto de operaciones.
    console.warn("No se pudo borrar el chat del trabajo:", trabajoId, e?.message || e);
  }
}
