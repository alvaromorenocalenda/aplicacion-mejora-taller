const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "europe-west1";

exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { trabajoId } = context.params;
    const msg = snap.data() || {};

    const senderUid = msg.uid || null;
    const text = (msg.text || "").toString();

    const title = "Nuevo mensaje";
    const body =
      text.length > 80 ? text.slice(0, 77) + "..." : text || "Tienes un mensaje nuevo";

    const url = `/chat-trabajo/${trabajoId}`;

    console.log("📩 Nuevo mensaje:", trabajoId, "senderUid:", senderUid);

    // 1️⃣ Obtener TODOS los tokens (aunque /users/{uid} no exista)
    const tokensSnap = await admin.firestore().collectionGroup("fcmTokens").get();

    if (tokensSnap.empty) {
      console.log("❌ No hay tokens");
      return null;
    }

    const tokens = [];

    tokensSnap.forEach((doc) => {
      const parts = doc.ref.path.split("/");
      const uid = parts[1]; // users/{uid}/fcmTokens/{token}

      // token puede ser campo o id del doc
      const token = doc.data()?.token || doc.id;
      if (!token) return;

      // ❌ excluir al que envía el mensaje
      if (senderUid && uid === senderUid) return;

      tokens.push(token);
    });

    if (!tokens.length) {
      console.log("❌ No hay usuarios destino (solo remitente)");
      return null;
    }

    console.log("🎯 Tokens destino:", tokens.length);

    // 2️⃣ DATA-ONLY (el SW muestra la notificación)
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

    console.log(
      "✅ Enviado:",
      resp.successCount,
      "❌ Fallos:",
      resp.failureCount
    );

    resp.responses.forEach((r, i) => {
      if (!r.success) {
        console.error("❌ Token error:", r.error?.code, r.error?.message);
      }
    });

    return null;
  });
