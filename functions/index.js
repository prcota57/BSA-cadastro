// Cloud Function do BSA: roda a cada 1 minuto, olha a coleção "lembretesAgendados"
// e dispara notificação push (FCM) pros tokens do responsável (ou de todo mundo,
// se o lembrete não tiver responsável definido).
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

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

/* ---------------------------------------------------------------------
 * Backup automático semanal — roda sozinho, sem ninguém precisar tocar
 * em nada. Salva um bsa-backup-AAAA-MM-DD.json no Storage do próprio
 * projeto Firebase e mantém só as últimas 8 semanas (~2 meses),
 * apagando as mais antigas pra não acumular pra sempre.
 * ------------------------------------------------------------------- */
const COLECOES_BACKUP = [
  "alunos", "mensalidades", "presencas", "avaliacoesFisicas", "reposicoes",
  "contadores", "estoqueUniformes", "estoqueEquipamentos", "movimentacoes",
  "interesseUniformes", "mensageiroCampanhas", "medicoesVelocidade",
  "medicoesSalto", "tarefas", "cadastrosPendentes", "pendenciasReconhecimento",
  "captacaoPublica",
];
const APPDATA_DOCS_BACKUP = ["captacao_leads"];
const MAX_BACKUPS_GUARDADOS = 8;

function limparTimestampsAdmin(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
      }
      return value;
    })
  );
}

async function gerarBackupJSON() {
  const backup = { geradoEm: new Date().toISOString(), sistema: "BSA" };
  for (const nome of COLECOES_BACKUP) {
    const snap = await db.collection(nome).get();
    backup[nome] = snap.docs.map((doc) =>
      Object.assign({ _id: doc.id }, doc.data())
    );
  }
  for (const docId of APPDATA_DOCS_BACKUP) {
    const doc = await db.collection("appdata").doc(docId).get();
    backup[docId] = doc.exists ? doc.data() : null;
  }
  return limparTimestampsAdmin(backup);
}

exports.backupSemanal = onSchedule(
  { schedule: "every sunday 03:00", timeZone: "America/Sao_Paulo" },
  async () => {
    const dados = await gerarBackupJSON();
    const dataStr = new Date().toISOString().slice(0, 10);
    const caminho = `backups/bsa-backup-${dataStr}.json`;

    await bucket.file(caminho).save(JSON.stringify(dados, null, 2), {
      contentType: "application/json",
      metadata: { metadata: { origem: "backupSemanal" } },
    });

    const [arquivos] = await bucket.getFiles({ prefix: "backups/bsa-backup-" });
    const ordenados = arquivos.sort((a, b) => (a.name < b.name ? 1 : -1));
    const antigos = ordenados.slice(MAX_BACKUPS_GUARDADOS);
    await Promise.all(antigos.map((f) => f.delete().catch(() => {})));
  }
);

// Lista os backups automáticos disponíveis (nome, tamanho, data) pro app mostrar
exports.listarBackups = onCall(async () => {
  const [arquivos] = await bucket.getFiles({ prefix: "backups/bsa-backup-" });
  const comMeta = await Promise.all(
    arquivos.map(async (f) => {
      const [meta] = await f.getMetadata();
      return {
        nome: f.name.replace("backups/", ""),
        tamanhoKB: (Number(meta.size) / 1024).toFixed(1),
        criadoEm: meta.timeCreated,
      };
    })
  );
  comMeta.sort((a, b) => (a.nome < b.nome ? 1 : -1));
  return { backups: comMeta };
});

// Devolve o conteúdo de um backup automático específico, pra salvar no aparelho
exports.baixarBackup = onCall(async (request) => {
  const nome = request.data && request.data.nome;
  if (!nome || !/^bsa-backup-\d{4}-\d{2}-\d{2}\.json$/.test(nome)) {
    throw new Error("Nome de arquivo inválido");
  }
  const [conteudo] = await bucket.file("backups/" + nome).download();
  return { conteudo: conteudo.toString("utf8") };
});
