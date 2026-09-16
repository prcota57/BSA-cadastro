// Envia notificacoes push (FCM) para lembretes vencidos, sem depender de Cloud
// Functions/Firebase Billing -- roda via GitHub Actions a cada poucos minutos,
// usando a mesma credencial de servico ja usada no backup automatico
// (FIREBASE_SERVICE_ACCOUNT). Mesma logica da Cloud Function enviarLembretes
// (functions/index.js), so que disparada por cron do GitHub em vez de scheduler
// do Firebase.
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'bsa-app-493c3',
});

const db = admin.firestore();

async function main() {
  const agora = admin.firestore.Timestamp.now();
  const snap = await db
    .collection('lembretesAgendados')
    .where('enviado', '==', false)
    .where('dataHora', '<=', agora)
    .get();

  if (snap.empty) {
    console.log('Nenhum lembrete pendente.');
    return;
  }

  const tokensSnap = await db.collection('notificacaoTokens').get();
  const tokensPorPessoa = {};
  const todosTokens = [];
  tokensSnap.forEach((doc) => {
    const d = doc.data();
    if (!d.token) return;
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
        const resultado = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: '🔔 Lembrete BSA',
            body: lembrete.texto,
          },
        });
        console.log(
          `Lembrete "${lembrete.texto}" enviado: ${resultado.successCount}/${tokens.length} com sucesso`
        );
      } catch (e) {
        console.error('Erro ao enviar notificacao:', e);
      }
    } else {
      console.log(`Lembrete "${lembrete.texto}" sem token de destino, marcando como enviado.`);
    }

    await doc.ref.update({
      enviado: true,
      enviadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
