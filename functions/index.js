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

    // 1) Usuarios destino (excluye al remitente)
    const usersSnap = await admin.firestore().collection("users").get();

    const targetUids = usersSnap.docs
      .map((d) => d.id)
      .filter((uid) => uid && (!senderUid || uid !== senderUid));

    if (!targetUids.length) {
      console.log("No hay usuarios destino");
      return null;
    }

    // 2) Tokens de destinatarios
    const tokenSet = new Set();

    for (const uid of targetUids) {
      const tokSnap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("fcmTokens")
        .get();

      tokSnap.forEach((t) => {
        const token = (t.data() || {}).token || t.id; // tu docId ya es el token
        if (token) tokenSet.add(token);
      });
    }

    const tokens = Array.from(tokenSet);

    if (!tokens.length) {
      console.log("No hay tokens para notificar");
      return null;
    }

    // ✅ 3) Envío WEBPUSH con NOTIFICATION (Chrome la muestra siempre)
    const multicast = {
      tokens,
      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png", // si no existe, quítalo
        },
        fcmOptions: {
          link: url, // al clicar abre esa ruta
        },
      },
      // opcional: data (por si quieres usarlo luego)
      data: {
        url,
        trabajoId,
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    console.log("OK:", resp.successCount, "FAIL:", resp.failureCount);

    // 4) Limpiar tokens inválidos
    const badTokens = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        console.error("FCM error", idx, code, r.error?.message);

        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          badTokens.push(tokens[idx]);
        }
      }
    });

    if (badTokens.length) {
      const deletes = [];
      for (const uid of targetUids) {
        for (const bad of badTokens) {
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
