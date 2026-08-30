# Fase 4 — Social, confiança e segurança

Responsáveis: `mobile-engineer` + `trust-safety-engineer`. Veto: `rls-adversary`.
Fonte das caixas: `.claude/PLAN.md`. Decisões de produto: `docs/adr/0004-decisoes-fase-4.md`.

**Aceitação: os requisitos da Guideline 1.2 da App Store cumpridos e
demonstrados**, e o `rls-adversary` a correr outra vez a bateria de bloqueio.
A 1.2 não é uma lista de features simpáticas: é o que impede a app de ser
recusada. Denunciar, bloquear, moderar em 24 horas e ter forma de contactar o
programador — as quatro, ou não há submissão.

**Esta fase é sobretudo superfície e lógica sobre um esquema que já existe.** O
grafo social inteiro foi construído e atacado na Fase 1. O que falta não é
guardar relações: é deixar as pessoas criá-las, e provar que o bloqueio se
aplica em todo o lado onde aparece conteúdo de terceiros.

---

## O que já existe da Fase 1

Ler isto antes de escrever a primeira linha. A tentação desta fase é
reimplementar em TypeScript regras que já estão no motor — e uma regra em dois
sítios é uma regra que vai divergir.

### Tabelas

| tabela                  | onde                        | o que já garante                                                                                                                                      |
| ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `follows`               | `20260829120100_social.sql` | `(follower_id, followee_id)`, `state pending\|active`, check `follower <> followee`                                                                   |
| `circle_members`        | idem                        | `(owner_id, member_id)`, check `owner <> member`                                                                                                      |
| `blocks`                | idem                        | `(blocker_id, blocked_id)`; a direcção existe só para saber quem pode desfazer                                                                        |
| `reports`               | idem                        | `subject_type profile\|reply\|rating`, `reason` enum de 7 valores, `note` ≤ 500, `state open\|dismissed\|removed\|suspended`, `expires_at` a 180 dias |
| `moderation_audit`      | idem                        | `report_id`, `actor`, `action`, `detail jsonb`, `expires_at` a 2 anos                                                                                 |
| `profiles.circle_count` | `20260829120000_base.sql`   | `smallint check between 0 and 30`, escrita bloqueada por lista de colunas                                                                             |

### Triggers e funções — as regras já estão no motor

- `follows_forcar_estado()` · `security definer`. O cliente **não escolhe** o
  estado: `pending` se o alvo for privado, `active` se for público. E recusa a
  inserção se houver bloqueio em qualquer direcção. Um cliente que mande
  `state: 'active'` é corrigido em silêncio, não premiado.
- `follows_transicao()`. `active` nunca volta a `pending`; um follow nunca muda
  de pessoas. Recusar um pedido é `DELETE`, não `UPDATE`.
- `circulo_reciproco()` · `security definer`. Exige `follows` activo nos dois
  sentidos e recusa Círculo com quem está bloqueado.
- `circulo_contar()`. Mantém `profiles.circle_count` com um `UPDATE` que toma
  lock de linha — é isso, e não um `count(*)`, que torna o limite de 30 à prova
  de escrita concorrente.
- `bloqueio_demolir()` · `security definer`. Ao inserir em `blocks`, apaga os
  `follows` e os `circle_members` nos dois sentidos.
- `purgar_retencao()` · `security definer`, `execute` revogado a `authenticated`.
  Existe e **nunca foi chamada por ninguém**.
- Predicados: `blocked()`, `visible_profile()`, `in_my_circle()`,
  `tenho_balde()`. Todos `security definer`, todos justificados no ADR 0003.

### Políticas

`follows_ler` (só as linhas que me dizem respeito — é isto que impede
reconstruir uma contagem de seguidores por agregação), `follows_criar`,
`follows_aceitar`, `follows_apagar`; `circulo_ler/criar/apagar` (o Círculo de
terceiros não é visível a ninguém); `blocks_ler/criar/apagar` (quem é bloqueado
não sabe que o é); `reports_ler/criar`, **sem** `UPDATE` e **sem** `DELETE` — de
propósito: mudar o estado de uma denúncia é moderação e faz-se com
`service_role`. `moderation_audit` não tem uma única política, o que com RLS
activo significa zero linhas para toda a gente.

E a vista `profile_cards`, a abertura deliberada: quatro colunas de qualquer
perfil, sem `security_invoker`, para se poder pedir para seguir alguém privado.
Qualquer coluna acrescentada ali é uma fuga.

## O que é mesmo novo

Tirando o que se lê da lista acima, a Fase 4 tem de produzir:

1. **Superfícies.** Não existe um único ecrã social. Registo com escolha de
   handle, pesquisa de pessoas, perfil de terceiro nas três vistas, pedidos
   recebidos, gestão do Círculo, folha de bloquear/denunciar.
2. **O inventário de bloqueio.** «Lista escrita de todas as superfícies onde
   aparece conteúdo de terceiros, com um teste por cada.» Esse documento não
   existe, e é a peça que o `rls-adversary` vai usar para saber o que atacar.
3. **Convite por deep link.** Nada no esquema. Tabela nova.
4. **Moderação a funcionar.** As tabelas existem e estão vazias por construção:
   nada escreve em `moderation_audit`, e não há forma de mudar `reports.state`
   sem abrir uma sessão SQL. O ADR 0004 (D5) decidiu que na v1 é assim mesmo —
   mas com função transaccional e runbook, não com `UPDATE` à mão.
5. **Filtro de abuso** em handles e respostas, pt e en. Não existe: o handle só
   tem validação de formato, `^[a-z0-9_]{3,20}$`.
6. **Contactar o programador.** Nada.
7. **Cron da retenção.** A função existe; falta o agendamento — e com D3 deixou
   de ser higiene para passar a ser correcção.
8. **Cooldown de recusa e suspensão**, que são tabela e coluna novas saídas de
   D3 e D6.

**Deixou de ser novo porque deixou de existir:** adicionar por contactos. D8
tirou-o da v1.

### Três lacunas concretas encontradas na leitura do esquema

Não são opiniões, são coisas que faltam e que só se vêem lendo as migrações.
Todas as três têm tarefa própria e todas estão nas primeiras quatro:

- **Uma nota denunciada não é identificável** (→ F4-2). Uma nota não tem linha
  própria: é o par `(user_id, subject_type, subject_id)` em `rank_positions`, e é
  por isso que `reactions` e `replies` apontam para um trio. Mas `reports` tem um
  único `subject_id uuid` e um `subject_type` que vale `'rating'` sem dizer se é
  filme, série ou episódio. Denunciar a nota que o Rui deu ao episódio 3 grava um
  uuid que também poderia ser o de um filme. O moderador vai ter de adivinhar.
- **A auditoria é imutável só por acidente** (→ F4-2). `moderation_audit` não tem
  política nenhuma, portanto `authenticated` não lhe toca — mas `service_role`
  ignora RLS e pode fazer `UPDATE` e `DELETE` à vontade, e é `service_role` que
  vai escrever lá. «Imutável» tem de ser imposto, não assumido.
- **`purgar_retencao()` nunca foi chamada** (→ F4-3). Existe desde F1-2, com
  `execute` revogado a toda a gente menos `service_role`, e sem agendamento. Com
  D3 passa a ser o que separa um cooldown de uma lista negra permanente.

---

## Decisões de produto — respondidas

As oito estavam bloqueantes. Foram respondidas pelo dono do produto a
2026-08-30 e estão registadas em `docs/adr/0004-decisoes-fase-4.md`, com as
alternativas rejeitadas e o custo assumido de cada uma. O resumo fica aqui; as
alternativas ficam à vista de propósito — o valor de um registo destes está em
saber o que foi recusado, não só o que foi escolhido.

### D1 · Desbloquear restaura o Círculo? — **(c) confirmação forte, e nada volta**

Bloquear continua a demolir nos dois sentidos e passa a exigir uma confirmação
que diz «isto remove-vos do Círculo um do outro e não se desfaz». Desbloquear
devolve só a possibilidade de voltar a pedir. **Sem tabela de arquivo.**
Rejeitadas: (a) nada volta sem aviso, por transformar um toque acidental em
destruição silenciosa; (b) arquivar e propor restaurar, por ser a mais difícil
de apagar depois.

### D2 · O bloqueio apaga as respostas já escritas? — **(a) esconde**

Mantém-se o comportamento actual, que era uma propriedade emergente de
`visible_profile()` e passa a ser uma decisão testada. Nada a construir; tudo a
provar, em F4-11. Rejeitadas: (b) apagar, por fazer do bloqueio uma arma de
eliminação de conteúdo alheio; (c) híbrido por motivo de denúncia, por criar uma
regra que não se explica num ecrã.

### D3 · Um pedido recusado pode ser reenviado? — **(b) cooldown de 30 dias**

Tabela nova `follow_cooldowns`, sem política de `SELECT` para ninguém —
incluindo quem foi recusado, porque poder lê-la é saber da recusa. Retenção de
30 dias imposta por trigger e apagada por `purgar_retencao()`. Rejeitadas: (a)
sem limite, por ser um vector de assédio conhecido; (c) recusar bloqueia em
silêncio, por dar dois significados a `blocks`.

### D4 · A denúncia mostra o desfecho? — **(c) o que aconteceu ao conteúdo, nunca à conta**

«Recebida», depois «tratada», e junto a isso: conteúdo removido ou mantido. O
destino da conta denunciada não é legível pelo denunciante em coluna nenhuma.
Obriga a separar `report_state`, que hoje mistura conteúdo (`removed`) e conta
(`suspended`) no mesmo enum. Rejeitadas: (a) só «tratada», por ser a resposta que
faz as pessoas deixarem de denunciar; (b) desfecho completo, por expor a conta de
terceiros e por convidar a um recurso que esta fase não tem.

### D5 · Onde vive a moderação? — **(a) só SQL, com runbook escrito**

Sem ecrã na app e sem painel web. Função transaccional chamada por
`service_role`, e `docs/moderacao/runbook.md`. Rejeitadas: (b) ecrã na app, por
pôr código de moderação no bundle de toda a gente e criar uma condição «sou
admin» a defender; (c) painel web, adiada — é a sucessora natural e o ADR 0004
escreve os três gatilhos que a obrigam a existir.

### D6 · O que significa suspender? — **(a) não escreve, continua a ler**

`profiles.suspended_until` e um `AND` nas políticas de `INSERT` de conteúdo, com
duas excepções obrigatórias: uma conta suspensa continua a poder **bloquear** e
**denunciar**. A coluna fica fora do `grant update` de `profiles`. Rejeitadas:
(b) conta invisível, por obrigar a mexer em `visible_profile()` e reabrir a
Fase 1; (c) login bloqueado, por ser só de ida e por viver em `auth`, fora do
alcance dos testes pgTAP.

### D7 · O filtro de abuso recusa ou marca? — **(c) recusa em handles, revisão em respostas**

Handles são permanentes e públicos: recusa dura, no motor. Respostas têm 140
caracteres e no máximo 30 leitores que já se seguem: enfileiram em `reports`.
Rejeitadas: (a) recusa nos dois, por desproporção e falsos positivos em
português coloquial; (b) revisão nos dois, porque um handle abusivo faz o dano
antes de alguém olhar.

### D8 · Adicionar por contactos? — **(a) não fazer na v1**

Descoberta é pesquisa de handle e convite por deep link. A app não pede
contactos, não normaliza números e não calcula hashes. Rejeitadas: (b) hash
truncado, por prometer mais do que entrega num espaço de números enumerável por
força bruta; (c) PSI, por ser criptografia a mais para o estado do produto.

---

## Tarefas

Por ordem de dependência. **A ordem mudou depois das respostas** — três
dependências novas apareceram e estão assinaladas onde mordem.

### F4-1 · Inventário das superfícies de conteúdo de terceiros · `docs/plano/superficies.md`

Documento, não código, e é o primeiro porque tudo o resto se mede contra ele.
Cada linha: onde aparece conteúdo ou identidade de outra pessoa, que tabelas
alimenta o ecrã, e que política o protege. Feed, detalhe de título, detalhe de
episódio, perfil, ranking pessoal alheio, respostas, reacções, taste match,
pesquisa de handles, `profile_cards`, pedidos pendentes, lista do Círculo,
notificações da Fase 6, cartões de partilha da Fase 7.

Critério: cada superfície tem um teste pgTAP nomeado em F4-11 que prova que
desaparece sob bloqueio, nos dois sentidos. Uma superfície sem teste é uma linha
por fechar, e o `rls-adversary` recebe este ficheiro como mapa de ataque. Inclui
as superfícies das fases 6 e 7 que ainda não existem — marcadas como futuras,
para que quem as construir herde a obrigação em vez de a descobrir.

### F4-2 · Migração das lacunas e das decisões · `db-architect`

É esquema, não é UI. Cresceu com as respostas: D3, D4 e D6 são todas estruturais.
Cinco coisas, numa migração ou em várias, mas todas antes de qualquer ecrã:

1. **Identificação da nota denunciada.** `reports` ganha o que falta para
   distinguir um filme de uma série de um episódio no alvo `'rating'`.
2. **`moderation_audit` imutável a sério.** `update` e `delete` revogados, ou
   trigger que os recusa, com `service_role` incluído — é o papel que vai
   escrever lá.
3. **`follow_cooldowns`** (D3): `(followee_id, follower_id, refused_at,
expires_at)`, `expires_at` imposto por trigger a 30 dias, **sem política de
   `SELECT` para ninguém**, consultada em `security definer` pelo trigger de
   `follows`.
4. **Separação da máquina de estados de `reports`** (D4): o que aconteceu ao
   conteúdo é legível pelo denunciante; o que aconteceu à conta não é legível
   por ele em coluna nenhuma.
5. **`profiles.suspended_until`** (D6): fora do `grant update`, protegida pelo
   trigger que já protege `circle_count`, e um `AND` nas políticas de `INSERT`
   de conteúdo — com `blocks` e `reports` explicitamente **de fora**.

Critério: `supabase db reset` corre do zero; os 59 testes pgTAP e os 26 ataques
da Fase 1 continuam a passar, com a única excepção admissível dos que assertam
sobre a forma antiga de `report_state` — e essas alterações são enumeradas na
mensagem de commit, uma a uma, com a razão. Mais dois testes novos que não
existiam:

- Um teste que **enumera** as tabelas com `INSERT` concedido a `authenticated` e
  falha se alguma não referir `suspended_until`, excepto `blocks` e `reports`.
  Sem ele, D6 apodrece na primeira tabela nova de qualquer fase futura.
- Um teste que prova que o denunciante não consegue ler, por coluna nenhuma nem
  por agregação, o que aconteceu à conta que denunciou.

### F4-3 · Cron da retenção · **subiu do fim da fase para aqui**

Dependência nova criada por D3. `purgar_retencao()` deixou de ser higiene: é o
que faz de `follow_cooldowns` um cooldown em vez de uma lista permanente de quem
recusou quem. Tem de correr antes de a tabela receber a primeira linha.

Critério: agendada em staging e produção, a tratar as três tabelas, com registo
do que apagou. Verificada em staging com datas forçadas: uma recusa com 31 dias,
uma denúncia com 181 e uma auditoria com 2 anos e um dia deixam de existir. Uma
recusa com 29 dias sobrevive.

### F4-4 · `rls-adversary`, primeiro passe · **tarefa nova**

Dependência nova: F4-2 mexe em políticas da Fase 1 — o enum de `reports` e as
políticas de `INSERT`. Esperar pelo fim da fase para atacar isso é construir
quinze tarefas em cima de uma alteração não verificada ao único sítio onde vivem
as regras 1 a 3.

Critério: veredicto escrito sobre a migração de F4-2, com atenção particular a
três coisas — escrever com uma conta suspensa por chamada directa; ler o destino
da conta denunciada a partir do denunciante; e ler ou inferir `follow_cooldowns`,
por erro distinto, por latência ou por contagem. **Veredicto negativo pára a
fase aqui**, e não daqui a duas semanas.

### F4-5 · Camada de dados do grafo · `src/data/social/`

Hooks TanStack Query sobre as tabelas. Nenhuma regra de visibilidade aqui: o
cliente pede e a base decide. Um filtro em JavaScript que duplique uma política é
motivo de rejeição em revisão.

Critério: um teste por hook a provar que o erro do motor — bloqueio, limite de
30, reciprocidade em falta, cooldown, suspensão, handle recusado — chega tipado à
UI e não como um `PostgrestError` cru. Os erros do domínio já vêm com `errcode` e
mensagem em português nas funções da Fase 1; mapear, não reescrever. E o erro do
cooldown é **indistinguível** de qualquer outra recusa: se a mensagem for
específica, D3 fica sem efeito, porque quem a receber sabe que foi recusado.

### F4-6 · Filtro de handles no motor · **subiu, por causa de D7**

Dependência nova: D7 recusa handles abusivos na escrita, logo a recusa tem de
existir antes do ecrã que escolhe handles. Construir F4-7 primeiro é abrir um
caminho de escrita sem filtro e depois fechá-lo — e os handles criados nessa
janela ficam.

Critério: a recusa acontece no Postgres e é provada por chamada directa à API,
não pelo ecrã. Lista de termos em pt e en fora de qualquer componente. Uma
bateria de falsos positivos conhecidos — palavras legítimas que contêm outras, e
nomes próprios — que **têm de passar**, e que é a parte do teste que interessa.

### F4-7 · Registo e escolha de handle

Conta privada por omissão — já é o default da coluna, e o ecrã não pode ter um
interruptor que o contrarie no registo.

Critério: uma conta nova tem `is_private = true` verificado na base, não no
ecrã. O handle provisório gerado por `handle_new_user()` (`u` + uuid) é
substituído por escolha da pessoa antes de chegar ao feed. A verificação de
disponibilidade faz-se pelo `unique` a falhar, não por um oráculo novo — a
Fase 1 recusou uma função `handle_available` de propósito. Um handle recusado
pelo filtro de F4-6 dá uma mensagem que não é a de «já existe»: confundir as
duas transformaria o filtro num oráculo de handles ocupados.

### F4-8 · Seguir, deixar de seguir, pedidos pendentes, cooldown

Critério: seguir um perfil público fica `active` e seguir um privado fica
`pending`, verificado lendo a base e nunca o que o cliente enviou. Aceitar é
`UPDATE`; recusar é `DELETE` **e** escreve o cooldown na mesma transacção — uma
recusa sem cooldown não é possível, prova-se tentando. Repetir o pedido dentro de
30 dias falha com a mesma resposta que qualquer outra recusa daria; ao dia 31
passa. Nenhum ecrã mostra, nem calcula, uma contagem de seguidores — proibição
permanente.

### F4-9 · Círculo: adicionar, remover, limite de 30

Critério: a mensagem ao atingir o limite é do domínio e traduzida, em pt-PT e
en. Hoje, inserir o 31.º membro devolve uma violação de `check` sobre
`profiles.circle_count` — uma mensagem do Postgres sobre uma coluna que o
utilizador não sabe que existe. Tem de sair «o Círculo está cheio; para
adicionar alguém, tira outra pessoa primeiro». Tentar adicionar quem não segue
de volta dá a mensagem da reciprocidade, não um erro genérico.

### F4-10 · Bloquear, desbloquear, e a confirmação de D1

Critério: bloquear é imediato e bidireccional, e o efeito é verificável na base —
`follows` e `circle_members` desaparecem nos dois sentidos, e
`profiles.circle_count` desce dos dois lados. A confirmação diz, antes do acto,
que o Círculo se perde e que não se desfaz; o botão destrutivo é alcançável sem
ler o texto todo, porque quem bloqueia está com pressa. A pessoa bloqueada não
recebe nenhum sinal de o ser: nem erro distinto, nem ecrã diferente, nem latência
diferente. Desbloquear devolve zero relações — provado por teste, e não só pela
ausência de código que as restaure.

### F4-11 · Bateria de bloqueio, uma por superfície

Um teste pgTAP por linha do F4-1. `trust-safety-engineer` escreve; o
`rls-adversary` ataca depois, e não é a mesma pessoa a fazer as duas coisas.

Critério: cada superfície do inventário tem um teste que falha se a política for
removida. Um teste que passa com e sem a política não está a testar nada — cada
um é validado ao contrário, como o `check:secrets` da Fase 2. **Inclui o teste
de D2**: respostas escritas antes do bloqueio deixam de ser legíveis nos dois
sentidos, continuam na base, e voltam a ser legíveis se o bloqueio for desfeito.
Hoje isso é uma consequência acidental de `replies_ler` depender de
`rank_positions`; a partir deste teste é uma decisão que alguém tem de partir de
propósito.

### F4-12 · Denunciar perfil, resposta e nota

Critério: os três alvos funcionam e gravam a categoria certa, com a nota
identificada sem ambiguidade graças a F4-2. Os motivos são o enum
`report_reason` traduzido, não texto livre — o campo `note` é opcional e tem 500
caracteres. Denunciar não revela nada ao denunciado. Denunciar alguém que apaga
a conta a seguir mantém a denúncia legível, com o handle copiado. Uma conta
suspensa continua a poder denunciar (D6).

### F4-13 · Estado da denúncia para quem denuncia

Critério: o denunciante vê o estado das suas denúncias e de mais nenhumas — o
que `reports_ler` já garante — com dois níveis apenas: «recebida» e «tratada»,
esta última acompanhada do que aconteceu ao **conteúdo**. O teste que prova a
outra metade — que o destino da conta não é legível nem inferível — vive em F4-2,
onde é uma propriedade do esquema e não do ecrã.

### F4-14 · Moderação por SQL, auditoria e runbook

Critério: as três acções — ignorar, remover, suspender — mudam o estado da
denúncia e escrevem uma linha em `moderation_audit` na **mesma transacção**. Uma
acção sem auditoria é impossível, não é indesejável: prova-se tentando moderar
sem escrever a auditoria e vendo a transacção falhar. A auditoria não aceita
`UPDATE` nem `DELETE`, nem por `service_role`. `docs/moderacao/runbook.md`
escrito ao ponto de alguém que não construiu isto conseguir tratar uma denúncia
às onze da noite com o telemóvel na mão e um portátil emprestado.

Mais o aviso automático de denúncia aberta há mais de 12 horas — metade do
compromisso das 24. É o que torna detectável o primeiro dos três gatilhos de
revisão de D5, e sem ele a decisão de moderar por SQL não tem alarme nenhum.

### F4-15 · Revisão de respostas suspeitas (D7, segunda metade)

Critério: uma resposta que contenha um termo da lista é aceite, publicada, e
enfileirada em `reports` com uma razão automática distinguível das denúncias
humanas — o moderador tem de saber que aquilo veio de um filtro e não de uma
pessoa. O autor não é notificado nem impedido. A fila mistura-se com a de F4-14 e
está sujeita ao mesmo aviso das 12 horas.

### F4-16 · Convite por deep link

Critério: um convite tem dono, validade e uso único ou contado — decidido aqui,
não em runtime. Abrir o link sem a app instalada leva à loja e sobrevive à
instalação. Um convite não revela nada sobre o perfil de quem convida além do
que `profile_cards` já expõe. Um link expirado dá uma mensagem clara, não um
ecrã em branco. Com D8, este é o **único** caminho de crescimento da v1, o que
lhe sobe a fasquia: se for frágil, não há alternativa.

### F4-17 · Contactar o programador

Critério: alcançável em dois toques a partir das definições, funciona sem conta
iniciada, e o destino é monitorizado por uma pessoa. Um formulário que escreve
numa tabela que ninguém lê é pior do que um `mailto:`. É também a única via de
recurso de quem for recusado pelo filtro de handles (D7) ou suspenso (D6), e o
texto do ecrã tem de dizer isso.

### F4-18 · Dossier da Guideline 1.2 · `docs/lojas/guideline-1-2.md`

Critério: cada requisito da 1.2 com o ecrã ou o teste que o cumpre, incluindo a
demonstração cronometrada de uma denúncia tratada de ponta a ponta em menos de 24
horas pelo procedimento de D5. É o que se cola no formulário de revisão da App
Store e o que evita a segunda rejeição pelo mesmo motivo. Escrito no fim, com o
que existe — não com o que se pretende.

### F4-19 · `rls-adversary`, passe final

Bateria de bloqueio outra vez, agora contra as superfícies do F4-1, mais os
vectores novos desta fase: convites, filtro de abuso como oráculo de existência
de termos ou de handles, cooldown como oráculo de recusa, suspensão contornada
por chamada directa, e a fila de moderação.

Critério: veredicto positivo por escrito. **Sem ele a fase não fecha**, e nenhuma
quantidade de caixas marcadas o substitui.

### ~~F4-20 · Adicionar por contactos~~ — cancelada

D8 tirou-a da v1. Não se constrói, não se prepara terreno, e a app não pede
permissão de contactos. Fica escrito aqui em vez de desaparecer, porque a
proposta vai voltar: quando voltar, a resposta está no ADR 0004 e o que mudou
desde então tem de ser dito em voz alta.

---

## O que esta fase não faz

- **Não desenha o feed.** Seguir e Círculo produzem relações; o que se vê com
  elas é da Fase 5. O ecrã social desta fase é funcional e feio, e isso é uma
  escolha: desenhá-lo duas vezes é o desperdício, não a feiura.
- **Não notifica.** Um pedido de seguir aceite não manda push nesta fase. Todo
  o fan-out é da Fase 6, com fila, limites e janela de silêncio. A única
  excepção é o aviso interno de denúncia aberta há 12 horas, que é para o
  moderador e não passa por push.
- **Não sugere pessoas.** Nem «pessoas que talvez conheças», nem popularidade,
  nem grafo, nem contactos. Descoberta na v1 são duas coisas: pesquisa de handle
  e convite por link. Uma sugestão automática precisaria de ler o grafo de
  terceiros, que é exactamente o que `circulo_ler` proíbe.
- **Não mostra contagens.** Nem seguidores, nem seguidos, nem tamanho do Círculo
  de outra pessoa. A proibição é permanente e a Fase 1 fê-la impossível de
  contornar por agregação; esta fase não a reabre por conveniência de UI.
- **Não faz recurso de moderação.** Suspender não tem apelo na v1, e o filtro de
  handles também não. As duas vias de escape são a mesma: F4-17. Fica registado
  como dívida, e é a primeira coisa a doer se alguém for sancionado por engano.
- **Não constrói painel de moderação.** D5 adiou-o e escreveu os três gatilhos
  que o obrigam a existir. Se um deles disparar durante esta fase, isto deixa de
  ser verdade e escreve-se o ADR seguinte.
- **Não mexe em `visible_profile()`.** D6 escolheu a suspensão que não lhe toca,
  precisamente para isso. Qualquer proposta que a altere deixa de ser trabalho de
  Fase 4 e passa a ser uma reabertura da Fase 1, com os 26 ataques a correr
  outra vez.
