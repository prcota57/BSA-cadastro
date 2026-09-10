// Gera um backup completo do Firestore do BSA e salva em /backups no repositório.
// Roda toda semana via GitHub Actions, sem depender do Google Cloud Billing —
// só usa a credencial de serviço já existente (FIREBASE_SERVICE_ACCOUNT).
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'bsa-app-493c3',
});

const db = admin.firestore();

const COLECOES = [
  'alunos', 'mensalidades', 'presencas', 'avaliacoesFisicas', 'reposicoes',
  'contadores', 'estoqueUniformes', 'estoqueEquipamentos', 'movimentacoes',
  'interesseUniformes', 'mensageiroCampanhas', 'medicoesVelocidade',
  'medicoesSalto', 'tarefas', 'cadastrosPendentes', 'pendenciasReconhecimento',
  'captacaoPublica',
];
const APPDATA_DOCS = ['captacao_leads'];
const MAX_BACKUPS = 8; // ~2 meses de backups semanais

const LIMITE_CAMPO_GRANDE = 2000; // caracteres — acima disso, provavelmente é foto em base64

function limparTimestamps(obj) {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value instanceof admin.firestore.Timestamp) {
        return value.toDate().toISOString();
      }
      if (typeof value === 'string' && value.length > LIMITE_CAMPO_GRANDE) {
        // provavelmente uma foto em base64 — não entra no backup automático pra não
        // inchar o repositório sem parar; a foto continua salva normalmente no Firestore.
        return `[campo grande removido do backup automático (${value.length} caracteres) — continua salvo no Firestore]`;
      }
      return value;
    })
  );
}

async function main() {
  const backup = { geradoEm: new Date().toISOString(), sistema: 'BSA' };

  for (const nome of COLECOES) {
    const snap = await db.collection(nome).get();
    backup[nome] = snap.docs.map((doc) => Object.assign({ _id: doc.id }, doc.data()));
    console.log(nome + ': ' + backup[nome].length + ' registros');
  }
  for (const docId of APPDATA_DOCS) {
    const doc = await db.collection('appdata').doc(docId).get();
    backup[docId] = doc.exists ? doc.data() : null;
  }

  const limpo = limparTimestamps(backup);

  const pasta = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta);

  const dataStr = new Date().toISOString().slice(0, 10);
  const arquivo = path.join(pasta, `bsa-backup-${dataStr}.json`);
  fs.writeFileSync(arquivo, JSON.stringify(limpo, null, 2));
  console.log('Backup salvo em: ' + arquivo);

  // mantém só os últimos MAX_BACKUPS arquivos, apaga os mais antigos
  const arquivos = fs.readdirSync(pasta)
    .filter((f) => /^bsa-backup-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  const antigos = arquivos.slice(MAX_BACKUPS);
  antigos.forEach((f) => {
    fs.unlinkSync(path.join(pasta, f));
    console.log('Removido backup antigo: ' + f);
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
