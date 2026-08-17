// Cloud Function do BSA: roda a cada 1 minuto, olha a coleção "lembretesAgendados"
// e dispara notificação push (FCM) pros tokens do responsável (ou de todo mundo,
// se o lembrete não tiver responsável definido).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.enviarLembretes = onSchedule(
  { schedule: "every 1 minutes", timeZone: "America/Sao_Paulo" },
  async () => {
    const agora = admin.firestore.Timestamp.now();
    const snap = await db
      .collection("lembretesAgendados")
      .where("enviado", "==", false)
      .where("dataHora", "<=", agora)
      .get();

    if (snap.empty) return;

    const tokensSnap = await db.collection("notificacaoTokens").get();
    const tokensPorPessoa = {};
    const todosTokens = [];
    tokensSnap.forEach((doc) => {
      const d = doc.data();
      todosTokens.push(d.token);
      if (!tokensPorPessoa[d.pessoa]) tokensPorPessoa[d.pessoa] = [];
      tokensPorPessoa[d.pessoa].push(d.token);
    });

    for (const doc of snap.docs) {
      const lembrete = doc.data();
      const tokens =
        lembrete.responsavel && tokensPorPessoa[lembrete.responsavel]
          ? tokensPorPessoa[lembrete.responsavel]
          : todosTokens;

      if (tokens.length) {
        try {
          await admin.messaging().sendEachForMulticast({
            tokens,
            notification: {
              title: "🔔 Lembrete BSA",
              body: lembrete.texto,
            },
          });
        } catch (e) {
          console.error("Erro ao enviar notificação:", e);
        }
      }

      await doc.ref.update({
        enviado: true,
        enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
);
