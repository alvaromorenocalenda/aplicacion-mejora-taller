const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "aplicacion-mejora-taller",
});

const REGION = "europe-west1";

exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    console.log("🔥 FUNCION ACTIVA");

    const { trabajoId } = context.params;
    const msg = snap.data() || {};

    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body =
      text.length > 80 ? text.slice(0, 77) + "..." : text || "Tienes un mensaje nuevo";

    const url = `/chat-trabajo/${trabajoId}`;

    const usersSnap = await admin.firestore().collection("users").get();
    console.log("👥 users encontrados:", usersSnap.size);

    if (usersSnap.empty) {
      console.log("❌ usersSnap vacío");
      return null;
    }

    const tokens = [];

    for (const doc of usersSnap.docs) {
      const uid = doc.id;
      const tokSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("fcmTokens")
        .get();

      tokSnap.forEach((t) => tokens.push(t.id));
    }

    console.log("📲 tokens:", tokens.length);

    if (!tokens.length) {
      console.log("❌ No hay tokens");
      return null;
    }

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      webpush: {
        notification: { title, body },
        fcmOptions: { link: url },
      },
      data: { url },
    });

    console.log("✅ Enviado. success:", resp.successCount, "fail:", resp.failureCount);

    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        console.error("FCM error idx", idx, r.error?.code, r.error?.message);
      }
    });

    return null;
  });
