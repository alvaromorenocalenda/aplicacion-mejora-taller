const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const REGION = "europe-west1";

// Path correcto según tu BD: chats_trabajos/{trabajoId}/messages/{messageId}
exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const { trabajoId } = context.params;
    const msg = snap.data() || {};

    // ✅ IMPORTANTE: tu mensaje SI tiene uid (lo has enseñado en captura)
    const senderUid = msg.uid || null;

    const text = (msg.text || "").toString();
    const displayName = (msg.displayName || "").toString();

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
      console.log("No hay usuarios destino (solo existe el remitente)");
      return null;
    }

    // 2) Tokens (sin duplicados)
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
        // en tu colección el docId ES el token, y además guardas meta sin "token"
        const token = data.token || t.id;
        if (token) tokensSet.add(token);
      });
    }

    const tokens = Array.from(tokensSet);

    if (!tokens.length) {
      console.log("No hay tokens para notificar");
      return null;
    }

    // 3) ✅ WEBPUSH NOTIFICATION (esto lo muestra Chrome SIEMPRE en background)
    const multicast = {
      tokens,
      webpush: {
        notification: {
          title,
          body,
          // si no tienes icono, comenta la siguiente línea
          // icon: "/icon-192.png",
        },
        fcmOptions: {
          link: url,
        },
      },
      // data opcional
      data: {
        url,
        trabajoId,
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    console.log("Notificación -> OK:", resp.successCount, "FAIL:", resp.failureCount);

    // 4) limpiar tokens inválidos
    const invalid = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code;
        console.error("FCM error:", code, r.error?.message);

        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalid.push(tokens[idx]);
        }
      }
    });

    if (invalid.length) {
      // borrar invalidos de TODOS los users (seguro)
      const users2 = await admin.firestore().collection("users").get();
      const deletes = [];

      for (const u of users2.docs) {
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
