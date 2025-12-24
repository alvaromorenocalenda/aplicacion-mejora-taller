const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const REGION = "europe-west1";

exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore
  .document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const msg = snap.data() || {};
    const { trabajoId } = context.params;

    const senderUid = msg.uid;
    if (!senderUid) {
      console.log("❌ Mensaje sin uid, no notifico");
      return null;
    }

    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body = text || "Tienes un mensaje nuevo";
    const url = `/chat-trabajo/${trabajoId}`;

    console.log("📩 Nuevo mensaje en", trabajoId, "sender:", senderUid);

    // 1️⃣ TODOS los tokens del sistema
    const tokensSnap = await admin.firestore()
      .collectionGroup("fcmTokens")
      .get();

    if (tokensSnap.empty) {
      console.log("❌ No hay tokens");
      return null;
    }

    const tokens = [];

    tokensSnap.forEach(doc => {
      const path = doc.ref.path.split("/");
      const uid = path[1]; // users/{uid}/fcmTokens/{tokenId}

      if (uid === senderUid) return; // ❌ NO notificamos al remitente

      const token = doc.data().token || doc.id;
      tokens.push(token);
    });

    if (!tokens.length) {
      console.log("❌ Solo hay tokens del remitente");
      return null;
    }

    console.log("✅ Tokens destino:", tokens.length);

    // 2️⃣ DATA-ONLY (evita duplicados)
    const message = {
      tokens,
      data: {
        title,
        body,
        url,
      },
    };

    const res = await admin.messaging().sendEachForMulticast(message);

    console.log(
      "📨 Enviado:",
      "OK =", res.successCount,
      "FAIL =", res.failureCount
    );

    return null;
  });
