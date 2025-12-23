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

    // ✅ Marcadores para confirmar que ESTA versión es la que se está ejecutando
    console.log("🔥 VERSION FUNCION: v3 (23-12) - notifyOnChatMessage");
    console.log("trabajoId:", trabajoId);
    console.log("messageId:", context.params.messageId);

    // OJO: en tus mensajes no viene uid -> no filtramos por sender
    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body =
      text.length > 80
        ? text.slice(0, 77) + "..."
        : text || "Tienes un mensaje nuevo";

    const url = `/chat-trabajo/${trabajoId}`;

    // 1️⃣ Obtener usuarios (TODOS)
    let usersSnap;
    try {
      usersSnap = await admin.firestore().collection("users").get();
    } catch (e) {
      console.error("❌ Error leyendo /users:", e?.message || e);
      return null;
    }

    console.log("usersSnap.size =", usersSnap.size);
    console.log(
      "users ids (max 5) =",
      usersSnap.docs.slice(0, 5).map((d) => d.id)
    );

    const targetUids = usersSnap.docs.map((d) => d.id).filter((uid) => uid);

    if (!targetUids.length) {
      console.log("❌ No hay usuarios destino (colección /users vacía o sin docs)");
      return null;
    }

    // 2️⃣ Obtener tokens
    const tokens = [];
    for (const uid of targetUids) {
      try {
        const tokSnap = await admin
          .firestore()
          .collection("users")
          .doc(uid)
          .collection("fcmTokens")
          .get();

        tokSnap.forEach((t) => {
          // Puede estar guardado como campo "token" o como id del doc
          const token = (t.data() || {}).token || t.id;
          if (token) tokens.push({ uid, token });
        });
      } catch (e) {
        console.error(`❌ Error leyendo tokens de uid=${uid}:`, e?.message || e);
      }
    }

    console.log("tokens encontrados =", tokens.length);
    if (!tokens.length) {
      console.log("❌ No hay tokens para notificar (subcolección fcmTokens vacía)");
      return null;
    }

    // 3️⃣ NOTIFICACIÓN WEB (lo correcto en navegador)
    const multicast = {
      tokens: tokens.map((t) => t.token),

      data: {
        url,
        trabajoId,
      },

      webpush: {
        notification: {
          title,
          body,
          icon: "/icon-192.png", // si no existe, puedes borrar esta línea
        },
        fcmOptions: {
          link: url,
        },
      },
    };

    let resp;
    try {
      resp = await admin.messaging().sendEachForMulticast(multicast);
    } catch (e) {
      console.error("❌ Error enviando FCM:", e?.code, e?.message || e);
      return null;
    }

    console.log(
      "✅ Notificación enviada. Éxitos:",
      resp.successCount,
      "Errores:",
      resp.failureCount
    );

    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        console.error(
          "FCM error token idx",
          idx,
          "uid:",
          tokens[idx]?.uid,
          "code:",
          r.error?.code,
          "msg:",
          r.error?.message
        );
      }
    });

    // 4️⃣ Limpiar tokens inválidos
    const badTokens = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const err = r.error && r.error.code;
        if (
          err === "messaging/registration-token-not-registered" ||
          err === "messaging/invalid-registration-token"
        ) {
          badTokens.push(tokens[idx]);
        }
      }
    });

    if (badTokens.length) {
      console.log("🧹 Tokens inválidos a borrar:", badTokens.length);
    }

    await Promise.all(
      badTokens.map(({ uid, token }) =>
        admin
          .firestore()
          .collection("users")
          .doc(uid)
          .collection("fcmTokens")
          .doc(token)
          .delete()
          .catch(() => null)
      )
    );

    return null;
  });
