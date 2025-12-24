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

    // IMPORTANTE: en tus mensajes SÍ tienes uid (lo vi en tu captura)
    const senderUid = msg.uid || null;

    const text = (msg.text || "").toString();
    const title = "Nuevo mensaje";
    const body =
      text.length > 80 ? text.slice(0, 77) + "..." : text || "Tienes un mensaje nuevo";

    const url = `/chat-trabajo/${trabajoId}`;

    console.log("📩 Nuevo mensaje en trabajoId:", trabajoId, "senderUid:", senderUid);

    // ✅ 1) Leer TODOS los tokens aunque /users/{uid} NO exista
    const tokensSnap = await admin.firestore().collectionGroup("fcmTokens").get();

    console.log("🔎 Tokens encontrados (collectionGroup):", tokensSnap.size);

    if (tokensSnap.empty) {
      console.log("❌ No hay tokens para notificar");
      return null;
    }

    // ✅ 2) Construir lista de tokens (y excluir al remitente)
    const tokens = [];
    tokensSnap.forEach((doc) => {
      // doc.ref.path: users/{uid}/fcmTokens/{tokenDocId}
      const pathParts = doc.ref.path.split("/");
      const uid = pathParts[1]; // users/{uid}/...

      // token: o viene en campo "token" o el id del doc
      const data = doc.data() || {};
      const token = data.token || doc.id;

      if (!token) return;

      // Excluir remitente (si hay uid en el mensaje)
      if (senderUid && uid === senderUid) return;

      tokens.push({ uid, token });
    });

    console.log("🎯 Tokens destino tras filtrar remitente:", tokens.length);

    if (!tokens.length) {
      console.log("❌ No hay usuarios destino (solo existe el remitente o no hay más tokens)");
      return null;
    }

    // ✅ 3) Enviar notificación WEB correcta (para Chrome/PC)
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
          // icon opcional, si no existe en /public, bórralo
          icon: "/icon-192.png",
        },
        fcmOptions: {
          link: url,
        },
      },
    };

    const resp = await admin.messaging().sendEachForMulticast(multicast);

    console.log(
      "✅ Enviado. OK:",
      resp.successCount,
      "FAIL:",
      resp.failureCount
    );

    // Log de errores por token
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        console.error(
          "❌ FCM error idx",
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

    // ✅ 4) Limpiar tokens inválidos
    const bad = [];
    resp.responses.forEach((r, idx) => {
      if (!r.success) {
        const code = r.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          bad.push(tokens[idx]);
        }
      }
    });

    if (bad.length) {
      console.log("🧹 Limpiando tokens inválidos:", bad.length);
      await Promise.all(
        bad.map(async ({ token }) => {
          // Buscar el doc exacto por id en collectionGroup no se puede borrar directo,
          // pero como el docId es el token, borramos por query:
          const qs = await admin.firestore().collectionGroup("fcmTokens")
            .where(admin.firestore.FieldPath.documentId(), "==", token)
            .get();

          await Promise.all(qs.docs.map((d) => d.ref.delete().catch(() => null)));
        })
      );
    }

    return null;
  });
