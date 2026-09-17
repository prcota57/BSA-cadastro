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

const LIMITE_ATRASO_MS = 60 * 60 * 1000; // 1h — acima disso, marca como enviado sem notificar (evita reaparecer lembrete velho de uma pane)

function linkParaResponsavel(responsavel) {
  if (responsavel === 'Ronaldo') return 'bsa-tarefas-ronaldo.html';
  if (responsavel === 'Iasmin') return 'bsa-tarefas-iasmin.html';
  return 'bsa-tarefas.html';
}

async function main() {
  const agora = admin.firestore.Timestamp.now();
  // Só um filtro no Firestore (enviado == false) pra não depender de índice composto
  // (que nunca foi criado, já que a Cloud Function original nunca rodou de verdade).
  // O filtro de horário (dataHora <= agora) é feito aqui no código.
  const snapTodos = await db.collection('lembretesAgendados').where('enviado', '==', false).get();
  const docsVencidos = snapTodos.docs.filter((doc) => {
    const dh = doc.data().dataHora;
    return dh && dh.toMillis() <= agora.toMillis();
  });

  if (docsVencidos.length === 0) {
    console.log(`Nenhum lembrete vencido (${snapTodos.size} pendente(s) aguardando o horário).`);
    return;
  }

  const tokensSnap = await db.collection('notificacaoTokens').get();
  const tokensPorPessoa = {};
  const todosTokensSet = new Set();
  tokensSnap.forEach((doc) => {
    const d = doc.data();
    if (!d.token) return;
    todosTokensSet.add(d.token);
    if (!tokensPorPessoa[d.pessoa]) tokensPorPessoa[d.pessoa] = new Set();
    tokensPorPessoa[d.pessoa].add(d.token);
  });
  const todosTokens = [...todosTokensSet];

  for (const doc of docsVencidos) {
    const lembrete = doc.data();
    const atrasoMs = agora.toMillis() - lembrete.dataHora.toMillis();

    if (atrasoMs > LIMITE_ATRASO_MS) {
      console.log(`Lembrete "${lembrete.texto}" atrasado demais (${Math.round(atrasoMs / 60000)} min) — marcando como enviado sem notificar.`);
      await doc.ref.update({ enviado: true, enviadoEm: admin.firestore.FieldValue.serverTimestamp(), puladoPorAtraso: true });
      continue;
    }

    const tokens =
      lembrete.responsavel
        ? (tokensPorPessoa[lembrete.responsavel] ? [...tokensPorPessoa[lembrete.responsavel]] : [])
        : todosTokens; // sem responsável definido = notifica todo mundo cadastrado

    if (tokens.length) {
      try {
        const resultado = await admin.messaging().sendEachForMulticast({
          tokens,
          notification: {
            title: '🔔 Lembrete BSA',
            body: lembrete.texto,
          },
          webpush: {
            fcmOptions: { link: linkParaResponsavel(lembrete.responsavel) },
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
