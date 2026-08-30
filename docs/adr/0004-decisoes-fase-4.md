# ADR 0004 — As oito decisões que fixam a Fase 4

- Estado: aceite
- Data: 2026-08-30
- Decisor: dono do produto (resposta directa)
- Consequência imediata: desbloqueia F4-2, F4-4, F4-5, F4-7, F4-9, F4-10, F4-11 e F4-12; **elimina** F4-14
- Contexto completo das alternativas: `docs/plano/fase-4.md`

## Contexto

A Fase 4 não constrói grafo social — ele existe desde a Fase 1, com triggers,
predicados e políticas já atacados pelo `rls-adversary`. O que a Fase 4 constrói
são superfícies, e mais oito comportamentos que o esquema deixou deliberadamente
em aberto porque nenhum deles se decide com argumentos técnicos.

Seis destas decisões traduzem-se em estrutura de base de dados. Duas — D2 e D8 —
traduzem-se em **não construir nada**, e é por isso que estão aqui: uma decisão
de não fazer, sem registo escrito, volta a ser proposta daqui a três meses por
alguém que a acha uma boa ideia.

---

## D1 — Desbloquear não restaura nada, e o bloqueio avisa antes

Bloquear continua a demolir a relação nos dois sentidos, como
`bloqueio_demolir()` já faz. Desbloquear devolve apenas a possibilidade de voltar
a pedir para seguir, do zero. **Não existe tabela de arquivo.**

Em troca, bloquear passa a exigir uma confirmação que diz o que vai acontecer,
com estas palavras ou equivalentes: «isto remove-vos do Círculo um do outro e
não se desfaz».

### Alternativas rejeitadas

- **Arquivar a relação e propor restaurá-la ao desbloquear.** Rejeitada por ser
  a mais difícil de apagar depois: obriga a guardar os detalhes de uma relação
  que uma das partes quis terminar, com uma retenção nova a justificar nas
  etiquetas de privacidade, e a UI de restauro é permanente a partir do dia em
  que existe. Era a opção simpática; é também a que se torna irreversível mais
  depressa.
- **Nada volta, sem aviso nenhum.** Rejeitada porque transforma um toque
  acidental na destruição silenciosa de uma relação. A confirmação custa uma
  folha e duas strings de i18n.

### Custo assumido

Um bloqueio feito em dez segundos de irritação destrói uma relação de meses, e
não há botão que a desfaça. As duas pessoas têm de voltar a seguir-se nos dois
sentidos e a reconstruir o lugar no Círculo à mão — e se algum dos Círculos
entretanto encheu, o lugar pode já não existir. É o preço de o bloqueio ser um
mecanismo de segurança e não uma preferência de visualização: um bloqueio que se
desfaz sozinho não protege ninguém.

Segundo custo, menor mas real: a confirmação acrescenta atrito exactamente no
momento em que alguém está a tentar afastar-se de outra pessoa. A folha tem de
ser curta e o botão destrutivo tem de estar visível sem ler nada.

## D2 — O bloqueio esconde as respostas já escritas; não as apaga

Mantém-se o comportamento actual, que ninguém tinha decidido: `replies_ler` exige
que a nota alvo seja visível, essa visibilidade passa por `visible_profile()`, e
`visible_profile()` já contém `blocked()`. As respostas continuam na base e
deixam de ser legíveis nos dois sentidos.

Isto não é nenhuma alteração de código. É a passagem de uma **propriedade
emergente** a uma **decisão testada** — e a diferença toda está aí: hoje, se
alguém reescrever `replies_ler` para deixar de depender de `rank_positions`, o
bloqueio deixa de cobrir respostas antigas e nenhum teste protesta.

### Alternativas rejeitadas

- **Apagar as respostas nos dois sentidos dentro de `bloqueio_demolir()`.**
  Rejeitada porque faz do bloqueio uma arma: eu bloqueio-te e o teu texto
  desaparece, sem moderação, sem denúncia e sem apelo. Apagar conteúdo alheio é
  um poder de moderação, não de utilizador.
- **Esconder por omissão e apagar quando o bloqueio nasce de uma denúncia de
  assédio.** Rejeitada por criar dois caminhos com comportamentos diferentes que
  não se conseguem explicar num ecrã — e uma regra que não se explica é uma
  regra que os utilizadores aprendem a temer.

### Custo assumido

Desbloquear faz reaparecer conversas antigas que a pessoa pode ter assumido como
perdidas. É uma surpresa desagradável e não há aviso previsto para ela.

E fica registado o que isto significa em disco: as respostas de relações
bloqueadas ficam guardadas indefinidamente sem nunca mais serem lidas. Não é uma
fuga — nenhuma política as devolve — mas é um dado pessoal retido sem propósito
activo, e se um dia houver um pedido de eliminação selectiva é aqui que ele bate.

## D3 — Um pedido recusado tem 30 dias de espera

Recusar continua a ser `DELETE` na linha de `follows`. Passa a existir um
registo da recusa, e um novo `INSERT` do mesmo par dentro de 30 dias é rejeitado
pelo trigger `follows_forcar_estado()`, ou por um trigger irmão, com a mesma
mensagem opaca que qualquer outra recusa dá — nunca «foste recusado».

### Onde vive o dado, e quanto tempo

Tabela nova, `follow_cooldowns`, com `(followee_id, follower_id, refused_at,
expires_at)`.

- **Retenção: 30 dias**, e nem um dia mais. `expires_at` é imposto por trigger
  como em `reports`, e não é escolhido por quem escreve. A linha é apagada por
  `purgar_retencao()`, que passa a tratar três tabelas em vez de duas.
- **RLS: ninguém lê esta tabela.** Nem quem recusou, nem quem foi recusado — em
  particular quem foi recusado, porque poder lê-la é saber que a recusa
  aconteceu, e nesse caso mais valia dizê-lo na cara. Sem política de `SELECT`,
  como `moderation_audit`. O trigger consulta-a em `security definer`.

Isto é a diferença entre um cooldown e uma lista negra. Com 30 dias e apagamento
efectivo, o dado desaparece; sem o cron, é uma lista permanente de quem recusou
quem, o que é precisamente o oposto do que a decisão quer.

### Alternativas rejeitadas

- **Sem limite nenhum.** Rejeitada por ser um vector de assédio conhecido: um
  perfil privado pode ser inundado de pedidos pelo mesmo estranho, e a única
  defesa disponível seria bloquear — obrigar a vítima a um acto mais forte do
  que aquele que quis fazer.
- **Recusar bloqueia em silêncio.** Rejeitada por sobrecarregar `blocks` com dois
  significados. Uma lista de bloqueados cheia de pessoas que a dona nunca
  bloqueou é uma lista que ela deixa de perceber, e o desbloqueio de D1 fica
  incompreensível.

### Custo assumido

**Guardar a recusa é guardar exactamente aquilo que a pessoa recusou.** A base
passa a conter a frase «A pediu para seguir B e B disse que não» — um dado
socialmente sensível que não existia antes desta decisão, e que a Fase 1 tinha
evitado ao fazer da recusa um simples `DELETE`. Os 30 dias e a ausência de
`SELECT` são as duas coisas que tornam esse custo aceitável, e nenhuma das duas
é opcional.

Segundo custo: uma recusa por engano — o toque errado na folha — condena o outro
a 30 dias de silêncio sem que nenhum dos dois perceba porquê. Quem recusou não
tem forma de anular, porque anular exigiria mostrar a lista.

## D4 — A denúncia mostra o que aconteceu ao conteúdo, nunca à conta

Quem denuncia vê «recebida» e depois «tratada», e junto a essa palavra o que
sucedeu ao **conteúdo** denunciado: removido, ou mantido. Nunca o que sucedeu à
conta do denunciado.

### O que isto obriga no esquema

`report_state` mistura hoje as duas coisas num enum só: `open`, `dismissed`,
`removed`, `suspended`. `removed` é uma acção sobre conteúdo e `suspended` é uma
acção sobre uma conta; enquanto viverem na mesma coluna, mostrar uma sem mostrar
a outra é impossível sem lógica de cliente — e lógica de cliente a decidir o que
se revela é exactamente o que a regra 5 proíbe.

A máquina de estados separa-se em duas dimensões independentes: o estado do
tratamento, e a acção sobre o conteúdo. A acção sobre a conta vive noutro lado —
em `moderation_audit` e em `profiles.suspended_until` (D6) — e nunca numa coluna
que o denunciante possa ler. Detalhe do desenho fica para F4-2; o que este ADR
fixa é que **`reports` não pode ter uma coluna legível pelo denunciante que
revele o destino da conta denunciada**.

### Alternativas rejeitadas

- **Só «recebida» e «tratada».** Rejeitada por ser inútil a quem denuncia: não
  distingue «lemos e removemos» de «lemos e discordamos», e é a resposta que faz
  as pessoas deixarem de denunciar.
- **Desfecho completo, incluindo a suspensão.** Rejeitada por duas razões: expõe
  o estado da conta de um terceiro a quem não tem nada a ver com ele, e convida
  a contestar a decisão — o que exigiria um processo de recurso que esta fase
  não tem e que D6 também não constrói.

### Custo assumido

Uma pessoa assediada em série vê «tratada, conteúdo removido» dez vezes e nunca
sabe se o assediador continua com a conta aberta. Vai concluir que não está a
acontecer nada, e pode ter razão ou não — a app não lho diz. É uma escolha a
favor da privacidade do denunciado contra a tranquilidade do denunciante, e a
única mitigação prevista é o bloqueio, que resolve o caso individual sem
resolver a sensação.

Custo técnico: mexer no enum `report_state` toca numa tabela da Fase 1 e nos
testes pgTAP que a cobrem. É a alteração mais invasiva que esta fase faz ao
esquema fechado.

## D5 — Moderação por SQL, com runbook escrito

Não há ecrã de moderação na app, nem painel web. As três acções — ignorar,
remover, suspender — executam-se com `service_role` através de uma função que
escreve `reports` e `moderation_audit` na mesma transacção. O procedimento fica
escrito em `docs/moderacao/runbook.md`: como abrir a sessão, como listar a fila,
que comando corre cada acção, e o que dizer a quem denunciou.

### Alternativas rejeitadas

- **Ecrã de moderação dentro da app, para um handle de admin.** Rejeitada por
  duas razões independentes, qualquer uma suficiente: põe código de moderação no
  bundle de toda a gente, e cria uma condição «sou admin» que passa a ser a
  superfície de ataque mais valiosa do produto.
- **Página web separada com `service_role` no servidor.** Rejeitada por agora,
  mas é a sucessora natural — não tem nada de admin no cliente e continua a ser
  fácil de deitar fora, porque é um projecto à parte. É para onde esta decisão
  aponta quando o gatilho abaixo disparar.

### Custo assumido — e o gatilho que obriga a rever

**Moderar via psql às onze da noite não acontece.** Esta frase é o custo inteiro,
e está escrita aqui para que daqui a um ano ninguém possa dizer que não sabia.
A Guideline 1.2 da App Store exige acção sobre conteúdo denunciado em 24 horas.
O que garante essas 24 horas nesta decisão não é um sistema: é a disponibilidade
de uma pessoa com acesso à base de dados, a um portátil e à vontade de o abrir
ao fim de semana. Isso funciona com dez utilizadores conhecidos e falha sem
aviso a partir de um número que ninguém consegue prever.

A decisão **é revista, e a opção do painel web construída, ao primeiro destes
acontecimentos**:

1. Uma denúncia passa das 24 horas sem tratamento. Uma só, sem discussão de
   circunstâncias atenuantes.
2. Entra o primeiro utilizador fora do círculo de conhecidos directos — ou seja,
   alguém que não pode ser contactado por WhatsApp para resolver um problema.
3. A fila tem mais de cinco denúncias abertas ao mesmo tempo, uma vez que seja.

Qualquer um dos três dispara a revisão. Não é uma métrica a acompanhar num
gráfico: é um gatilho, e quem o vir dispara escreve o ADR seguinte.

Para o primeiro ser detectável, a fila tem de ser vista — e uma fila que só se vê
entrando na base não é vista. Fica em F4-11 o aviso automático de denúncia aberta
há mais de 12 horas, que é a metade do compromisso.

## D6 — Suspender é perder a escrita, não o acesso

Uma conta suspensa continua a ler tudo o que lia. Não escreve nada: nem notas,
nem posições, nem respostas, nem reacções, nem pedidos para seguir, nem
Círculo.

Materializa-se numa coluna `suspended_until timestamptz` em `profiles`, e num
`AND` nas políticas de `INSERT` das tabelas de conteúdo.

**Duas excepções obrigatórias.** Uma conta suspensa continua a poder **bloquear**
e a poder **denunciar**. Tirar a alguém as ferramentas de segurança porque essa
pessoa se portou mal é criar uma vítima nova; e uma conta suspensa por engano
ficaria sem forma nenhuma de se proteger.

**A coluna não é escrita pelo dono do perfil.** Fica fora da lista de
`grant update` de `profiles` — a lista que já protege `circle_count` — e o
trigger `profiles_proteger_contador()` passa a recusar também alterações a
`suspended_until` fora do contexto da moderação. Isto não é opcional: uma
suspensão que o suspenso possa levantar com um PATCH não é uma suspensão.

### Alternativas rejeitadas

- **Conta invisível para todos.** Rejeitada por obrigar a acrescentar um ramo a
  `visible_profile()`, que é a função mais sensível do esquema. Mexer nela é
  reabrir a Fase 1 inteira e correr outra vez os 26 ataques por causa de uma
  funcionalidade de moderação que se usará talvez uma vez por ano.
- **Login bloqueado.** Rejeitada por ser um caminho só de ida sem processo de
  recurso, e por se fazer em `auth` em vez de `public` — o que a poria fora do
  alcance dos testes pgTAP que cobrem tudo o resto.

### Custo assumido

Uma pessoa suspensa por assediar continua a **ler** as notas de quem assediou,
desde que a relação não tenha sido bloqueada. A suspensão cala-a, não a afasta.
Para a vítima, quem resolve o problema é o bloqueio; a suspensão é uma sanção,
não uma protecção, e é importante não as confundir na comunicação.

Segundo custo, técnico e imediato: o `AND` tem de estar em **todas** as políticas
de `INSERT` de conteúdo, e uma tabela nova criada em qualquer fase futura
esquece-se dele por omissão. É o mesmo padrão de erro que a Fase 1 evitou ao pôr
`not blocked()` dentro de `visible_profile()` em vez de o repetir em cada
política. Aqui não há esse abrigo: F4-2 tem de deixar um teste que enumera as
tabelas com `INSERT` para `authenticated` e falha se alguma não referir
`suspended_until`. Sem esse teste, esta decisão apodrece na primeira tabela nova.

## D7 — Handles recusam; respostas vão a revisão

Duas políticas diferentes, porque as duas coisas são diferentes:

- **Handles** são permanentes, públicos e aparecem ao lado de quem não os
  escolheu. Um termo abusivo é recusado na escrita, com erro, no motor.
- **Respostas** têm 140 caracteres, vivem dentro do Círculo e são vistas por no
  máximo 30 pessoas que já se seguem mutuamente. Um termo suspeito é aceite e
  enfileirado em `reports` para revisão.

O filtro dos handles vive no Postgres. Um filtro só no cliente é contornável por
chamada directa à API, e o handle passaria à mesma.

### Alternativas rejeitadas

- **Recusa dura nos dois.** Rejeitada pelos falsos positivos: 140 caracteres de
  português coloquial entre amigos apanham qualquer lista de termos, e ser
  impedido de dizer o que se quer a um Círculo de 30 pessoas que já nos escolheu
  é desproporcionado.
- **Revisão nos dois.** Rejeitada porque um handle abusivo publicado enquanto
  espera revisão aparece em resultados de pesquisa e ao lado de notas de outras
  pessoas — o dano dá-se antes de alguém olhar.

### Custo assumido

Uma lista de termos proibidos dentro do Postgres é uma lista que alguém tem de
manter, em duas línguas, e que produz falsos positivos em nomes próprios e em
palavras que contêm outras. Vai haver alguém impedido de escolher um handle
legítimo, e essa pessoa não terá recurso nenhum além do contacto de F4-15.

Do outro lado, uma resposta abusiva fica visível ao Círculo até alguém a rever —
e com moderação por psql (D5), «alguém a rever» pode ser amanhã.

## D8 — Adicionar por contactos não se faz na v1

A descoberta de pessoas na primeira versão é: pesquisa de handle, e convite por
deep link. Mais nada. A app não pede acesso aos contactos, não normaliza números,
não calcula hashes e não fala de números de telefone em lado nenhum.

### Alternativas rejeitadas

- **Hash truncado no dispositivo.** Rejeitada por prometer mais do que entrega.
  O espaço de números de telemóvel portugueses é pequeno o suficiente para ser
  enumerado por força bruta, portanto o HMAC protege contra uma fuga da base de
  dados, não contra nós próprios; e o prefixo enviado é ou curto de mais para
  ser útil ou longo de mais para ser anónimo.
- **Set intersection privado a sério.** Rejeitada por ser criptografia a mais
  para um produto que ainda não sabe se as pessoas querem comparar filmes.

### Custo assumido

Crescimento mais lento, e é o custo real e não um detalhe: uma app social que
depende de convites individuais cresce por convite individual. Se a app não
arrancar, esta decisão vai estar na lista de suspeitos, e não haverá forma de
saber se foi culpada.

Em troca: zero dados de terceiros que nunca deram consentimento, uma etiqueta de
privacidade a menos na App Store, uma superfície de fuga a menos, e a
funcionalidade que é mais fácil de apagar de todas — a que nunca foi escrita.

---

## Efeitos secundários que estas respostas criaram

Três dependências novas que a decomposição anterior de `docs/plano/fase-4.md`
não previa, registadas aqui porque mudam a ordem do trabalho:

1. **O cron da retenção deixa de ser higiene e passa a ser correcção.** Com D3, é
   `purgar_retencao()` que transforma `follow_cooldowns` num cooldown em vez de
   uma lista negra permanente. Tem de existir antes de a tabela receber a
   primeira linha, não no fim da fase.
2. **O filtro de handles passa a bloquear o registo.** Com D7, o ecrã de escolha
   de handle não pode ser construído antes de a recusa existir no motor — de
   outro modo nasce um caminho de escrita sem filtro que depois há que fechar.
3. **F4-2 passa a mexer em políticas da Fase 1.** D4 altera o enum de `reports` e
   D6 acrescenta uma condição às políticas de `INSERT`. A bateria do
   `rls-adversary` tem de correr **contra essa migração**, e não apenas no fim da
   fase.
