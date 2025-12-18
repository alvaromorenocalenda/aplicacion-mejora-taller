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

    const senderUid = msg.uid;
    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body = text.length > 80 ? text.slice(0, 77) + "..." : text || "Tienes un mensaje nuevo";
    const url = `/chat-trabajo/${trabajoId}`;

    // Buscar usuarios en /users
    const usersSnap = await admin.firestore().collection("users").get();
    const targetUids = usersSnap.docs
      .map((d) => d.id)
      .filter((uid) => uid && uid !== senderUid);

    if (!targetUids.length) return null;

    // Recoger tokens de todos los destinatarios
    const tokens = [];
    for (const uid of targetUids) {
      const tokSnap = await admin.firestore().collection("users").doc(uid).collection("fcmTokens").get();
      tokSnap.forEach((t) => {
        const token = (t.data() || {}).token || t.id;
        if (token) tokens.push({ uid, token });
      });
    }

    if (!tokens.length) return null;

    // Enviar notificación
    const multicast = {
      notification: { title, body },
      data: { url, trabajoId },
      tokens: tokens.map((t) => t.token),
      webpush: {
        fcmOptions: { link: url },
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    // Limpiar tokens inválidos
    const badTokens = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const err = r.error && r.error.code;
        if (err === "messaging/registration-token-not-registered" || err === "messaging/invalid-registration-token") {
          badTokens.push(tokens[idx]);
        }
      }
    });

    await Promise.all(
      badTokens.map(({ uid, token }) =>
        admin.firestore().collection("users").doc(uid).collection("fcmTokens").doc(token).delete().catch(() => null)
      )
    );

    return null;
  });
