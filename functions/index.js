const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "europe-west1";

/**
 * Trigger: cuando se crea un mensaje en un chat de trabajo
 * Path: chats_trabajos/{trabajoId}/messages/{messageId}
 */
exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { trabajoId } = context.params;
    const msg = snap.data() || {};

    const senderUid = msg.uid || null; // ✅ ahora sí lo tienes
    const text = (msg.text || "").toString();

    const title = "Nuevo mensaje";
    const body =
      text.length > 80
        ? text.slice(0, 77) + "..."
        : text || "Tienes un mensaje nuevo";

    // OJO: tu app usa esta ruta
    const url = `/chat-trabajo/${trabajoId}`;

    // 1) Obtener usuarios y EXCLUIR al que envía
    const usersSnap = await admin.firestore().collection("users").get();

    const targetUids = usersSnap.docs
      .map((d) => d.id)
      .filter((uid) => uid && (!senderUid || uid !== senderUid));

    if (!targetUids.length) {
      console.log("No hay usuarios destino (solo está el remitente o no hay users)");
      return null;
    }

    // 2) Obtener tokens de destinatarios
    const tokenSet = new Set();
    for (const uid of targetUids) {
      const tokSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("fcmTokens")
        .get();

      tokSnap.forEach((t) => {
        // tu estructura: docId = token, y dentro guardas createdAt/userAgent
        const token = (t.data() || {}).token || t.id;
        if (token) tokenSet.add(token);
      });
    }

    const tokens = Array.from(tokenSet);

    if (!tokens.length) {
      console.log("No hay tokens para notificar");
      return null;
    }

    // 3) Enviar DATA-ONLY (para NO duplicar notificaciones)
    const multicast = {
      tokens,
      data: {
        title,
        body,
        url,
        trabajoId,
      },
      // opcional: webpush headers
      webpush: {
        headers: {
          Urgency: "high",
        },
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    console.log(
      "Notificación enviada. Éxitos:",
      resp.successCount,
      "Errores:",
      resp.failureCount
    );

    // 4) Limpiar tokens inválidos
    const badTokenIds = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        console.error("FCM error", idx, code, r.error?.message);

        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          badTokenIds.push(tokens[idx]);
        }
      }
    });

    if (badTokenIds.length) {
      // borrar ese token de cualquier user que lo tenga (más robusto)
      const deletes = [];
      for (const uid of targetUids) {
        for (const bad of badTokenIds) {
          deletes.push(
            admin
              .firestore()
              .collection("users")
              .doc(uid)
              .collection("fcmTokens")
              .doc(bad)
              .delete()
              .catch(() => null)
          );
        }
      }
      await Promise.all(deletes);
    }

    return null;
  });
