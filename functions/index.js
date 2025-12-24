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

    // ✅ En tus mensajes existe uid (según tu captura)
    const senderUid = msg.uid || null;

    const text = (msg.text || "").toString().trim();
    const displayName = (msg.displayName || "").toString().trim();

    const title = displayName ? `Mensaje de ${displayName}` : "Nuevo mensaje";
    const body =
      text.length > 80 ? text.slice(0, 77) + "..." : text || "Tienes un mensaje nuevo";

    const url = `/chat-trabajo/${trabajoId}`;

    // 1) Usuarios destino: todos menos el remitente
    const usersSnap = await admin.firestore().collection("users").get();

    const targetUids = usersSnap.docs
      .map((d) => d.id)
      .filter((uid) => uid && (!senderUid || uid !== senderUid));

    if (!targetUids.length) {
      console.log("No hay usuarios destino");
      return null;
    }

    // 2) Tokens destino (Set para NO duplicar)
    const tokensSet = new Set();

    for (const uid of targetUids) {
      const tokSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("fcmTokens")
        .get();

      tokSnap.forEach((t) => {
        const data = t.data() || {};
        const token = data.token || t.id; // en tu caso el docId suele ser el token
        if (token) tokensSet.add(token);
      });
    }

    const tokens = Array.from(tokensSet);

    if (!tokens.length) {
      console.log("No hay tokens para notificar");
      return null;
    }

    // ✅ 3) DATA-ONLY (IMPORTANTÍSIMO para evitar duplicados)
    const multicast = {
      tokens,
      data: {
        title,
        body,
        url,
        trabajoId: String(trabajoId),
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    console.log("Enviado OK:", resp.successCount, "FAIL:", resp.failureCount);

    // Log detallado si falla algo
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        console.error("FCM error token idx", idx, r.error?.code, r.error?.message);
      }
    });

    // 4) limpiar tokens inválidos
    const invalid = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalid.push(tokens[idx]);
        }
      }
    });

    if (invalid.length) {
      const allUsers = await admin.firestore().collection("users").get();
      const deletes = [];

      for (const u of allUsers.docs) {
        for (const bad of invalid) {
          deletes.push(
            admin
              .firestore()
              .collection("users")
              .doc(u.id)
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
