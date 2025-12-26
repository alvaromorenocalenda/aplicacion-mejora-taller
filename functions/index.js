const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const REGION = "europe-west1";

/**
 * Notificación push cuando se crea un mensaje en:
 * chats_trabajos/{trabajoId}/messages/{messageId}
 *
 * Envía DATA-ONLY para evitar duplicados.
 */
exports.notifyOnChatMessage = functions
  .region(REGION)
  .firestore.document("chats_trabajos/{trabajoId}/messages/{messageId}")
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

    // 1) Obtener todos los tokens registrados
    const tokensSnap = await admin.firestore().collectionGroup("fcmTokens").get();

    if (tokensSnap.empty) {
      console.log("❌ No hay tokens");
      return null;
    }

    const tokens = [];
    tokensSnap.forEach((d) => {
      const data = d.data() || {};

      // Preferimos uid guardado dentro del doc (más fiable)
      const uid =
        data.uid ||
        (() => {
          const parts = d.ref.path.split("/");
          return parts[1]; // users/{uid}/fcmTokens/{tokenId}
        })();

      if (uid === senderUid) return; // ❌ no notificamos al remitente

      const token = data.token || d.id;
      if (token) tokens.push(token);
    });

    const uniqueTokens = Array.from(new Set(tokens));

    if (!uniqueTokens.length) {
      console.log("❌ Solo hay tokens del remitente (o no hay tokens válidos)");
      return null;
    }

    console.log("✅ Tokens destino:", uniqueTokens.length);

    // 2) DATA-ONLY
    const message = {
      tokens: uniqueTokens,
      data: {
        title,
        body,
        url,
        chatId: String(trabajoId),
        tag: `chat-${trabajoId}`,
      },
    };

    const res = await admin.messaging().sendEachForMulticast(message);

    console.log("📨 Enviado:", "OK =", res.successCount, "FAIL =", res.failureCount);

    // Logs de errores (y detección de tokens inválidos)
    res.responses.forEach((r, idx) => {
      if (!r.success) {
        const err = r.error;
        console.log(
          "❌ Error token idx",
          idx,
          err?.code || "",
          err?.message || err
        );
      }
    });

    return null;
  });
