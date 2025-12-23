const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.notifyOnChatMessage = functions
  .region("europe-west1")
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { trabajoId } = context.params;
    const msg = snap.data() || {};

    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body = text || "Tienes un mensaje nuevo";
    const url = `/chat-trabajo/${trabajoId}`;

    console.log("🔥 FUNCION ACTIVA");

    // 🔑 AQUÍ ESTÁ LA CLAVE
    const tokensSnap = await admin
      .firestore()
      .collectionGroup("fcmTokens")
      .get();

    console.log("📲 tokens encontrados:", tokensSnap.size);

    if (tokensSnap.empty) return null;

    const tokens = tokensSnap.docs.map(d => d.id);

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      webpush: {
        notification: { title, body },
        fcmOptions: { link: url },
      },
    });

    console.log("✅ enviados:", resp.successCount);
    return null;
  });
