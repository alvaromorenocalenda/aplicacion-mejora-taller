const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "europe-west1";

/**
 * Trigger:
 * chats_trabajos/{trabajoId}/messages/{messageId}
 */
exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { trabajoId, messageId } = context.params;
    const msg = snap.data() || {};

    // ✅ Detectar UID del remitente de forma robusta
    const senderUid =
      (typeof msg.uid === "string" && msg.uid) ||
      (typeof msg.senderUid === "string" && msg.senderUid) ||
      (typeof msg.userId === "string" && msg.userId) ||
      null;

    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body = text.length > 80 ? text.slice(0, 77) + "..." : (text || "Tienes un mensaje nuevo");
    const url = `/chat-trabajo/${trabajoId}`;

    console.log("📩 notifyOnChatMessage fired");
    console.log("trabajoId:", trabajoId, "messageId:", messageId);
    console.log("senderUid detectado:", senderUid);
    console.log("displayName:", msg.displayName || null);

    // 🚫 Si no sabemos quién lo envía, no enviamos (evita autospam)
    if (!senderUid) {
      console.log("❌ senderUid no encontrado en el mensaje. No envío notificación.");
      console.log("Campos del mensaje:", Object.keys(msg));
      return null;
    }

    // 1) Obtener TODOS los tokens guardados en /users/*/fcmTokens/*
    const tokensSnap = await admin.firestore().collectionGroup("fcmTokens").get();

    if (tokensSnap.empty) {
      console.log("❌ No hay tokens en Firestore (collectionGroup fcmTokens vacío).");
      return null;
    }

    // 2) Construir lista (uidDestino -> tokens) y EXCLUIR al remitente
    const tokensByUid = new Map(); // uid -> [token, token, ...]
    tokensSnap.forEach((doc) => {
      // doc.ref.path ejemplo: users/{uid}/fcmTokens/{tokenDocId}
      const parts = doc.ref.path.split("/");
      const uidFromPath = parts[0] === "users" ? parts[1] : null;

      if (!uidFromPath) return;

      // token puede estar en campo "token" o ser el id del doc
      const token = (doc.data() && doc.data().token) ? doc.data().token : doc.id;
      if (!token) return;

      // excluir al remitente
      if (uidFromPath === senderUid) return;

      if (!tokensByUid.has(uidFromPath)) tokensByUid.set(uidFromPath, []);
      tokensByUid.get(uidFromPath).push(token);
    });

    const targetUids = Array.from(tokensByUid.keys());
    console.log("👥 UIDs destino:", targetUids);

    if (targetUids.length === 0) {
      console.log("❌ No hay usuarios destino (solo hay tokens del remitente o no existen otros).");
      return null;
    }

    // 3) Aplanar tokens
    const tokens = targetUids.flatMap((uid) => tokensByUid.get(uid));
    console.log("🎯 Tokens destino totales:", tokens.length);

    if (!tokens.length) {
      console.log("❌ No hay tokens destino tras filtrar.");
      return null;
    }

    // 4) Envío DATA-ONLY (el SW muestra la notificación) => NO DUPLICADOS
    const payload = {
      tokens,
      data: {
        title,
        body,
        url,
        trabajoId,
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(payload);

    console.log("✅ Envío terminado. success:", resp.successCount, "fail:", resp.failureCount);

    // Log de errores por token (IMPORTANTE)
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        console.error("❌ FCM error idx", idx, "code:", r.error?.code, "msg:", r.error?.message);
      }
    });

    return null;
  });
