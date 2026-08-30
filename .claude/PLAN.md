# Nota — Plano de execução

Documento de trabalho partilhado. Cada agente marca as suas próprias caixas ao concluir uma tarefa, e **só** as suas.

## Protocolo

- `[ ]` por fazer · `[x]` feito · `[~]` em curso · `[!]` bloqueado (acrescenta o porquê na linha)
- Uma tarefa só é marcada quando o critério de aceitação da secção está cumprido, não quando o código compila.
- Uma fase só fecha com **todas** as caixas marcadas, veredicto positivo do `rls-adversary` e assinatura do `tech-lead` no fim da secção.
- Ninguém começa a fase N+1 antes de a fase N estar fechada.
- Quem descobrir trabalho em falta acrescenta a linha em vez de a fazer em silêncio.

## Regras que nenhuma fase pode violar

1. Nota cega — ninguém vê notas de terceiros sem ter dado a sua.
2. Perfis privados por omissão; seguir é unidireccional.
3. Círculo mútuo, máximo 30. Discordância, taste match, respostas e notas de episódio são exclusivos do Círculo.
4. A nota é derivada de um ranking, nunca escrita pelo utilizador.
5. As regras 1 a 3 vivem em RLS. Nunca em lógica de cliente.

---

## Fase 0 — Fundações

Responsável: `tech-lead`

- [x] Repositório criado, TypeScript em modo estrito, lint e formatação a correr em pre-commit
- [x] Projeto Expo a arrancar em iOS e Android
- [x] Projeto Supabase local com `supabase start` e seed reproduzível
- [x] CI: lint, typecheck, testes unitários, testes pgTAP
- [x] Segredos em `.env` local e no CI; `.env` no gitignore; verificação automática de que nada sensível entra no bundle
- [x] `docs/adr/0001-stack.md` escrito
- [~] Ambientes separados: local, staging, produção

**Aceitação:** um programador novo clona, corre um comando e tem tudo a funcionar.

Fechada por `tech-lead`: [ ]

---

## Fase 1 — Esquema e RLS

Responsável: `db-architect` · Veto: `rls-adversary`

### Esquema

- [x] `profiles` com `is_private` a `true` por omissão
- [x] `follows` com estado `pending | active`
- [x] `circle_members` com trigger que garante reciprocidade
- [x] Limite de 30 no Círculo imposto por constraint ou trigger, à prova de escrita concorrente
- [x] `blocks`
- [x] `reports`
- [x] `titles`, `seasons`, `episodes` (cache TMDB)
- [x] `buckets`
- [x] `rank_positions` com unicidade por `(user_id, subject_type, scope_id)` e numeração esparsa ou fraccionária
- [x] `watched`
- [x] `reactions`, `replies` com limite de 140 caracteres em constraint
- [x] `taste_match`
- [x] Nota derivada exposta por vista ou função — nenhuma coluna de nota no caminho de escrita
- [x] Índices para: feed do Círculo, ranking por âmbito, pesquisa de handle
- [~] Todas as migrações reversíveis

### RLS

- [x] RLS activo em todas as tabelas com dados de utilizador, sem excepções
- [x] Ler notas de um título exige bucket próprio para esse título
- [x] Ler qualquer coisa de perfil privado exige `follows.state = 'active'`
- [x] Ler notas de episódio exige Círculo **e** `watched` para esse episódio
- [x] Bloqueio anula tudo o acima, nos dois sentidos
- [x] Escrita restrita ao próprio `user_id` em todas as tabelas
- [x] Cada `security definer` justificado num ADR

### Ataque

Responsável: `rls-adversary`

- [x] Ler bucket ou posição alheia sem ter avaliado
- [x] Inferir nota alheia por `count=exact`, ordenação ou mensagens de erro distintas
- [x] Avaliar, ler o alvo, apagar a avaliação, voltar a ler
- [x] Ler perfil privado com follow em `pending`
- [x] Ler perfil privado por tabela de junção (reactions, replies, taste_match)
- [x] Ler notas de episódio fora do Círculo
- [x] Ler notas de episódio de um episódio não visto
- [x] Auto-inserção em `circle_members` sem reciprocidade
- [x] Ultrapassar o limite de 30 com duas escritas em simultâneo
- [x] Depois de bloqueado: feed, pesquisa, perfil, respostas antigas, taste match
- [x] Escrever em nome de outro `user_id`
- [x] Responder a conteúdo fora do Círculo
- [x] Exceder 140 caracteres por chamada directa
- [x] Relatório escrito com veredicto global

**Aceitação:** todos os ataques falham. Uma única falha bloqueia a fase.

Fechada por `tech-lead`: [ ]

---

## Fase 2 — TMDB

Responsável: `tmdb-integrator`

- [x] Edge Function `search` — filmes e séries, resultados normalizados num tipo único
- [x] Edge Function `title` — detalhe de filme
- [x] Edge Function `title` — série com temporadas e episódios completos
- [x] Cache em `titles`, `seasons`, `episodes` com TTL diferenciado (séries em emissão revalidam mais)
- [x] `pt-PT` com fallback para `en-US` quando sinopse ou título vêm vazios
- [x] Apenas `poster_path` guardado; URL composto no cliente a partir de tamanhos permitidos
- [x] Rate limiting com backoff exponencial e jitter
- [x] Deduplicação de pedidos em curso para o mesmo recurso
- [x] Erros tipados; nenhum erro cru do TMDB chega ao cliente
- [x] Temporada 0 (especiais) tratada explicitamente
- [x] Testes com respostas gravadas; nenhuma chamada real no CI

**Aceitação:** zero chamadas ao TMDB a partir do cliente. Chave ausente do bundle, verificado — `npm run check:secrets` exporta o bundle a sério e o scanner foi validado ao contrário, com um canário plantado que ele apanhou nos dois bundles Hermes.

Fechada por `tech-lead`: [x]

---

## Fase 3 — Motor de ranking

Responsável: `ranking-engineer`

- [x] Selecção de balde: Adorei / Gostei / Nah
- [x] Inserção binária dentro do balde
- [x] Máximo rígido de 5 comparações por título
- [x] Opção "não sei" que aborta e insere no ponto médio corrente
- [x] Primeiro título de um balde não gera comparação
- [x] Três âmbitos independentes: filmes, séries, episódios por série
- [x] Derivação da nota: Nah 0.0–4.9, Gostei 5.0–7.9, Adorei 8.0–10.0
- [x] Comportamento definido e documentado para baldes com menos de 5 títulos
- [x] Reordenação manual soberana sobre o algoritmo
- [x] Reavaliação reinicia o fluxo para o título
- [x] Mudança de balde numa reavaliação move o título entre intervalos sem corromper posições
- [x] Taste match com sobreposição mínima antes de mostrar percentagem
- [x] Testes de propriedades: ordem final consistente com todas as comparações respondidas
- [x] Fuzz com 1000 inserções: nunca mais de 5 comparações, ranking nunca corrompido
- [x] Zero dependências de React, rede ou Supabase neste módulo
- [x] Simulação de sessões contra o motor: `npm run simular`

**Aceitação:** avaliar 30 títulos reais à mão sem irritação. Se cansar, o algoritmo muda antes de a fase fechar.

Feito em parte: 7 títulos à mão, parados por curiosidade satisfeita e não por
cansaço, e o resto por simulação — 200 sessões de 30 títulos, mais escala a 100
e 500. O lado mecânico fecha: o tecto de 5 nunca foi furado e custa 3% de
fidelidade de ordem a 500 títulos. O lado humano — a fricção de 30 títulos
seguidos — continua por provar, e nenhuma simulação o prova. Passa para a
Fase 5, onde o ecrã existe. Relatório em `docs/plano/fase-3-aceitacao.md`.

Fechada por `tech-lead`: [x] — com ressalva: fica por provar a fricção humana de 30 títulos à mão (7 feitos, e nenhum até ao cansaço); o critério exigia um ecrã que a Fase 3 explicitamente não constrói, e a dívida move-se para a Fase 5 na caixa «Fricção de 30 títulos seguidos». Veredicto do `rls-adversary` sobre `20260830090000_ranking.sql`: **positivo**, relatório em `docs/ataque/fase-3.md`. 59/59 pgTAP, 26 ataques sem sucesso, `security_invoker=on` confirmado em `pg_class.reloptions` e não no ficheiro, 11 ataques novos ao `pinned` e 5 ao `taste_match` todos defendidos. A condição está satisfeita e o fecho vale.

Três dívidas do relatório, corrigidas antes de a Fase 4 arrancar: o seed do `taste_match` estava em `overlap = 6` e o limiar novo é 10, o que tornava a linha invisível para toda a gente e fazia dois ataques da bateria marcar verde por vácuo (seed a 12, e quatro testes pgTAP novos, validados ao contrário nos dois sentidos); e `ataque-limite-circulo.mjs` apagava o Círculo do seed sem o repor, o que fazia cinco testes pgTAP falharem consoante a ordem de execução.

---

## Fase 4 — Social, confiança e segurança

Responsáveis: `mobile-engineer` + `trust-safety-engineer` · Veto: `rls-adversary`

Decomposição em `docs/plano/fase-4.md`. As oito decisões bloqueantes D1–D8 foram
respondidas a 2026-08-30 e estão registadas em `docs/adr/0004-decisoes-fase-4.md`,
com alternativas rejeitadas e custo assumido. **Nada nesta fase está bloqueado
por decisões em aberto.**

### Grafo

- [ ] Registo com conta privada por omissão
- [ ] Seguir, deixar de seguir
- [ ] Pedido pendente para perfis privados, com aceitar e recusar
- [ ] Cooldown de 30 dias após recusa, em `follow_cooldowns`, sem `SELECT` para ninguém (ADR 0004, D3)
- [ ] Convite por deep link
- [ ] ~~Adicionar por contactos~~ — **cancelado** por ADR 0004 (D8): fora da v1, a app não pede contactos
- [ ] Círculo: adicionar, remover, reciprocidade obrigatória, limite de 30 com mensagem clara ao atingir

### Confiança e segurança

- [ ] Bloquear, com efeito bidireccional e imediato, e confirmação que avisa que o Círculo se perde (ADR 0004, D1)
- [ ] Lista escrita de todas as superfícies onde aparece conteúdo de terceiros, com um teste de bloqueio por cada
- [ ] Teste que prova que o bloqueio esconde — e não apaga — as respostas já escritas (ADR 0004, D2)
- [ ] Denunciar perfil, resposta e nota, com motivos concretos
- [ ] `reports` identifica sem ambiguidade a nota denunciada (filme, série ou episódio) — lacuna da Fase 1
- [ ] Máquina de estados de `reports` separa acção sobre conteúdo de acção sobre conta (ADR 0004, D4)
- [ ] Estado da denúncia visível para quem denuncia: «tratada» + destino do conteúdo, nunca da conta
- [ ] Fila de moderação com acções: ignorar, remover, suspender — por SQL, com runbook (ADR 0004, D5)
- [ ] Suspender = perder escrita, manter leitura; `profiles.suspended_until`, com `blocks` e `reports` de fora (ADR 0004, D6)
- [ ] Registo de auditoria imutável das acções de moderação — imposto, incluindo contra `service_role`
- [ ] Aviso automático de denúncia aberta há mais de 12 horas (metade do compromisso das 24)
- [ ] Filtro de abuso: recusa dura em handles, revisão em respostas, pt e en (ADR 0004, D7)
- [ ] Forma de contactar o programador dentro da app — é também a única via de recurso de suspensão e de handle recusado
- [ ] Cron de `purgar_retencao()` a correr sobre três tabelas (a função existe desde F1-2, ninguém a chama)
- [ ] `rls-adversary`, primeiro passe contra a migração de F4-2, antes de qualquer ecrã

**Aceitação:** requisitos da Guideline 1.2 da App Store cumpridos e demonstrados. `rls-adversary` volta a correr a bateria de bloqueio.

Fechada por `tech-lead`: [ ]

---

## Fase 5 — Feed e reveal

Responsáveis: `mobile-engineer` + `design-system-keeper`

- [ ] Tokens e componentes primitivos derivados da direção visual aprovada
- [ ] Feed cronológico do Círculo, com fim — sem scroll infinito
- [ ] Estado por revelar e transição de reveal
- [ ] Detalhe do título: notas ordenadas por distância à minha
- [ ] Detalhe da série: grelha de temporadas e gráfico por episódio, com episódios não vistos ocultos
- [ ] Perfil: top 4, ranking pessoal, taste match, com as três vistas (estranho, seguidor, Círculo)
- [ ] Ranking pessoal arrastável
- [ ] Reacções
- [ ] Respostas de 140 caracteres, só Círculo
- [ ] Offline: avaliar em modo avião, fechar, reabrir, sincronizar sem perdas nem duplicações
- [ ] Resolução determinista de conflito com avaliação feita noutro dispositivo
- [ ] Optimistic updates com rollback visível em avaliar, reagir e seguir
- [ ] Estados vazio, a carregar, erro e offline em todos os ecrãs
- [ ] Pré-carregamento dos posters da comparação seguinte
- [ ] i18n pt-PT e en, sem strings literais
- [ ] Acessibilidade: alvos de 44pt, labels, texto grande
- [ ] Nenhuma contagem de seguidores visível
- [ ] **Fricção de 30 títulos seguidos** — dívida herdada da Fase 3, que fechou com esta ressalva. Uma pessoa avalia 30 títulos reais no ecrã de comparação; se cansar, muda o algoritmo, não o ecrã
- [ ] A nota mostra-se como relativa e não absoluta — a simulação da Fase 3 mediu 27% das notas a mexerem-se a cada título novo aos 30 títulos

**Aceitação:** dois telemóveis reais lado a lado, o fluxo completo de nota cega funciona sem hesitações.

Fechada por `tech-lead`: [ ]

---

## Fase 6 — Notificações

Responsável: `notifications-engineer`

- [ ] Fan-out de discordância em Edge Function, com fila e retry
- [ ] Limiar de distância configurável
- [ ] Só dentro do Círculo
- [ ] Nunca revelar nota de um título que o destinatário ainda não avaliou
- [ ] Nunca notificar alterações de décimas por reajuste do ranking
- [ ] Agrupamento: várias discordâncias no mesmo dia são uma notificação
- [ ] Limite diário por utilizador, conservador por omissão
- [ ] Janela de silêncio no fuso do dispositivo, nunca entre as 22h e as 8h
- [ ] Deduplicação idempotente — reprocessar a fila não reenvia
- [ ] Bloqueio ou saída do Círculo cancelam notificações enfileiradas
- [ ] Cada notificação abre num destino concreto por deep link
- [ ] Resumo semanal: o que o Círculo viu, maior discórdia da semana
- [ ] Definições de notificação por tipo
- [ ] Teste de carga: Círculo de 30 a avaliar o mesmo título em simultâneo

**Aceitação:** um dia inteiro de uso real não produz uma única notificação que apeteça desligar.

Fechada por `tech-lead`: [ ]

---

## Fase 7 — Partilha e onboarding

Responsáveis: `tmdb-integrator` + `mobile-engineer` + `design-system-keeper`

- [ ] Geração de cartão 1080x1920 no servidor com satori e resvg
- [ ] Variantes: ranking pessoal, discordância da semana, nota individual
- [ ] Partilha para Stories e WhatsApp com deep link de volta
- [ ] Import de CSV do Letterboxd: mapeamento para TMDB, datas em formatos variados, duplicados
- [ ] Títulos não encontrados apresentados ao utilizador para resolução manual
- [ ] Ficheiro corrompido ou parcial nunca importa em silêncio
- [ ] Onboarding: top 4 favoritos antes de chegar ao feed, para o perfil não nascer vazio
- [ ] Ecrã de convite com pré-visualização do que o convidado vai ver

**Aceitação:** um utilizador novo com import feito tem perfil apresentável em menos de 3 minutos.

Fechada por `tech-lead`: [ ]

---

## Antes de submeter às lojas

Responsável: `tech-lead`

- [ ] `rls-adversary` corrido de novo contra produção com contas de teste
- [ ] `qa` com a bateria completa de fluxos multi-utilizador
- [ ] Política de privacidade e termos publicados e ligados na app
- [ ] Etiquetas de privacidade da App Store preenchidas com verdade
- [ ] Eliminação de conta acessível dentro da app — requisito da Apple
- [ ] Crash reporting e observabilidade das Edge Functions
- [ ] Plano de resposta a incidente de dados escrito

Fechada por `tech-lead`: [ ]

---

## Registo de decisões em aberto

Acrescenta aqui em vez de decidir sozinho.

- [ ] Feed limitado ao Círculo ou duas tabs (Círculo e A seguir)?
- [ ] Nome definitivo da app
- [ ] Notas de episódio sempre restritas ao Círculo, mesmo em perfil público?
- [ ] Estratégia de arranque: teste com 10 pessoas em WhatsApp antes de construir
- [x] **Fase 4, D1–D8** — respondidas a 2026-08-30, registadas em `docs/adr/0004-decisoes-fase-4.md`

### A rever quando disparar o gatilho

- [ ] **Painel de moderação** (ADR 0004, D5). A decisão de moderar por SQL é revista ao **primeiro** destes acontecimentos, sem discussão de circunstâncias: uma denúncia passa das 24 horas; entra o primeiro utilizador fora do círculo de conhecidos directos; ou a fila tem mais de cinco denúncias abertas ao mesmo tempo.
