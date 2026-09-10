# Manual de Recuperação Total do Sistema BSA

Este documento existe pra uma situação específica: se por qualquer motivo tudo precisar ser reconstruído do zero — perda de acesso às contas, problema técnico grave, ou simplesmente porque quem originalmente ajudou a construir (Claude/Anthropic) não estiver mais disponível. Qualquer pessoa ou assistente de IA que leia este arquivo junto com o código-fonte dos repositórios abaixo consegue reconstruir o sistema inteiro.

## O que é o BSA

Sistema de gestão da BSA (Brazilian Skills Academy), academia de futebol infantojuvenil em Belo Horizonte, com duas unidades: Carlos Prates e Estoril. Cobre cadastro de alunos, presença (com reconhecimento facial), financeiro/mensalidades, captação de leads, estoque de uniformes, avaliações físicas, reposições, comunicação em massa (WhatsApp) e módulos de treino (aquecimento, velocidade, salto, etc.).

## Onde está tudo

**Código-fonte** — GitHub, conta `prcota57`, todos os repositórios públicos (sem custo, com histórico completo de versões):
- `BSA-cadastro` — Hub central + cadastro, presença, financeiro, captação, avaliação, estoque, mensageiro, diretora, backup, tarefas e os formulários públicos
- `bsa-treino` — módulo Colchão
- `bsa-cores` — módulo Cores
- `bsa-alerta` — sons de apito/treino
- `bsa-reflexo` — Contador de Rebote (Rebatedor)
- `bsa-velocidade` — Medidor de Velocidade
- `bsa-salto` — Medidor de Salto
- `bsa-aquecimento` — Aquecimento por voz

Todo o código é HTML/JS puro (sem build/compilação), hospedado gratuitamente no GitHub Pages. Qualquer um desses `.zip` pode ser baixado direto pelos links dentro do próprio módulo BSA Backup.

**Dados** — Firebase, projeto `bsa-app-493c3`, banco Firestore na região `southamerica-east1`, autenticação anônima. As chaves de configuração (`firebaseConfig`) já estão dentro do próprio código de cada módulo — não são segredo, são de uso público no navegador (a segurança real do banco fica nas regras do Firestore, configuradas no console do Firebase).

Coleções principais: `alunos`, `mensalidades`, `presencas`, `avaliacoesFisicas`, `reposicoes`, `contadores`, `estoqueUniformes`, `estoqueEquipamentos`, `movimentacoes`, `interesseUniformes`, `mensageiroCampanhas`, `medicoesVelocidade`, `medicoesSalto`, `tarefas`, `cadastrosPendentes`, `pendenciasReconhecimento`, `captacaoPublica`, mais o documento `captacao_leads` dentro de `appdata`.

**Backups dos dados** — arquivo `bsa-backup.json`, gerado pelo módulo BSA Backup (dentro do Hub, seção Sistema) e salvo manualmente onde o usuário escolher (recomendado: Arquivos do iPhone, com cópia no iCloud Drive). Contém todos os registros de todas as coleções acima. Não é automático — depende de alguém tocar no botão periodicamente (há um lembrete mensal configurado nos Reminders do usuário).

## Como reconstruir tudo do zero

Se as contas originais (GitHub e/ou Firebase) ainda existirem, normalmente basta recuperar o acesso a elas — nada precisa ser recriado. Este roteiro é pro cenário mais extremo, onde as contas em si também se perderam:

1. **Recriar o código:** baixar (ou clonar via `git clone`) cada um dos repositórios listados acima — o histórico de commits explica a evolução de cada decisão.
2. **Criar um novo projeto Firebase:** ativar Firestore (modo produção, região `southamerica-east1` ou mais próxima), e criar um app Web dentro dele pra gerar um novo `firebaseConfig`.
3. **Atualizar o `firebaseConfig`** no topo de cada arquivo `.html` (é o mesmo bloco em todos os módulos) com as novas chaves do passo anterior.
4. **Publicar os arquivos** em qualquer hospedagem estática — GitHub Pages (como já é hoje), Netlify, Vercel, ou até um servidor próprio. Não exige nada além de servir arquivos estáticos.
5. **Repor os dados:** usar o botão "Restaurar backup (emergência)" dentro do próprio módulo BSA Backup, escolhendo o `bsa-backup.json` mais recente disponível. Ele recria cada registro nas coleções corretas, com os mesmos IDs de antes. (Datas/horários voltam como texto simples nesse processo — normal, e reversível revisando os registros afetados depois.)
6. **Conferir as regras de segurança do Firestore** no console do novo projeto — como a autenticação é anônima, as regras precisam permitir leitura/escrita nas coleções listadas (revisar o que fazia sentido no projeto original).

## Resumo pra quem for reconstruir

Código no GitHub (com histórico) + dados no `bsa-backup.json` (gerado periodicamente) + este manual = o sistema inteiro pode ser reconstruído por qualquer desenvolvedor ou assistente de IA, mesmo sem qualquer contato com quem o construiu originalmente. Recomendado manter cópias do backup em pelo menos dois lugares diferentes (ex: iCloud Drive + Google Drive), já que ele é a única cópia dos dados que não depende de nenhuma conta continuar acessível.
