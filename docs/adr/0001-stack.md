# 0001 — Stack e destino do protótipo de UI

- Estado: aceite
- Data: 2026-08-28
- Autor: `tech-lead`
- Fase: 0

## Contexto

A Nota é uma app social de notas de filmes, séries e episódios com três regras de
produto que não são funcionalidades mas invariantes de segurança: nota cega,
visibilidade de perfil (privado por omissão) e Círculo mútuo com máximo de 30.
O `CLAUDE.md` fixa que estas três regras vivem em RLS no Postgres e nunca em
lógica de cliente. Isto tem uma consequência directa na escolha da stack: o
cliente tem de poder falar com a base de dados sem uma camada de servidor
própria a servir de guardiã, porque uma camada dessas convida a que as regras
migrem para lá.

O estado real do repositório em 2026-08-28, verificado:

- Existe um protótipo de UI funcional: 12 rotas em `app/` (tabs `index`,
  `procurar`, `ranking`, `eu`; mais `titulo/[id]`, `serie/[id]`,
  `perfil/[handle]`, `avaliar/balde`, `avaliar/comparar`, `partilhar/[id]`),
  9 componentes em `src/components/`, tokens em `src/theme/`, i18n pt-PT e en
  em `src/i18n/`, dados falsos em `src/data/fixtures.ts` e uma derivação de nota
  provisória em `src/ranking/derive.ts` com teste.
- Não existe `supabase/`, `docs/`, CI, lint, `.env`, testes pgTAP, nem
  repositório git.
- `package.json` tem `start`, `typecheck` e `test`. Não tem
  `@supabase/supabase-js`, nem `@tanstack/react-query`, nem `zustand`.
- Todos os ecrãs importam directamente de `@/data/fixtures`. Não existe camada
  de dados nem interface a substituir.

Ou seja: existe código de aparência de Fase 5 antes de as Fases 0 a 2 estarem
feitas. O protótipo não está ligado a nada, o que é simultaneamente a razão pela
qual é barato e a razão pela qual é perigoso — parece mais adiantado do que é.

Este ADR fixa a stack e decide o que fazer ao protótipo. As duas coisas estão no
mesmo documento porque a segunda decisão só faz sentido à luz da primeira.

## Opções consideradas

### A. Plataforma cliente

1. **Expo (React Native) com Expo Router.** Uma linguagem em toda a stack,
   OTA updates, EAS Build sem máquina macOS dedicada, deep links (necessários
   nas Fases 6 e 7) resolvidos por convenção de ficheiros.
2. React Native sem Expo. Mais controlo sobre módulos nativos, muito mais custo
   de manutenção de build para uma app que não tem requisitos nativos exóticos.
3. Nativo duplicado (Swift + Kotlin). Melhor resultado final, dois de tudo.
   Inviável para a dimensão da equipa.

### B. Backend

1. **Supabase (Postgres + Auth + RLS + Realtime + Edge Functions).** RLS é
   exactamente o mecanismo que as regras 1 a 3 exigem: a política é avaliada no
   motor, não no caminho de código. PostgREST permite ao `rls-adversary` atacar
   as políticas de fora, sem passar pela app.
2. Firebase. As regras de segurança do Firestore não expressam bem "só vês a
   nota deste título se tiveres um bucket teu para este título" sem
   desnormalização agressiva, e a nota cega passaria a depender da forma como os
   dados foram duplicados. Rejeitado por não conseguir suportar o invariante
   central.
3. API própria (Node/Deno) sobre Postgres gerido. Devolve o controlo, mas move
   as regras para o código da API — precisamente o que o `CLAUDE.md` proíbe em
   espírito. Rejeitado.

### C. Funções de servidor

1. **Edge Functions em Deno**, no mesmo projecto Supabase. TypeScript, segredos
   fora do bundle, adjacentes à base de dados.
2. Cloudflare Workers ou Vercel Functions. Mais um fornecedor, mais uma origem
   de segredos, mais uma superfície de CORS, sem benefício claro nas Fases 2, 6
   e 7.

### D. Estado no cliente

1. **TanStack Query para estado de servidor + Zustand para estado de UI.**
   Fronteira clara: se o dado vem do Postgres é Query, se só existe no ecrã é
   Zustand. A fila offline da Fase 5 assenta bem na persistência do Query.
2. Redux Toolkit com RTK Query. Equivalente em capacidade, mais cerimónia.
3. Só Zustand. Obrigaria a reescrever cache, revalidação e optimistic updates
   com rollback à mão. Rejeitado.

### E. Testes

1. **Vitest para lógica pura (motor de ranking, derivação, i18n) + pgTAP para
   esquema e RLS.** O ponto essencial é que as regras 1 a 3 são testadas onde
   vivem: dentro do Postgres, com `set local role` e `request.jwt.claims`, não
   através da app.
2. Jest em vez de Vitest. Já há Vitest configurado e a passar; a diferença não
   justifica a troca.
3. Só testes end-to-end. Insuficiente: um teste e2e que passa não prova que uma
   chamada directa ao PostgREST falha.

### F. Destino do protótipo de UI

1. **Apagar.** Honesto quanto à ordem das fases, mas deita fora trabalho de
   direcção visual que tem valor real e que é caro reproduzir.
2. **Manter em `app/` atrás das fixtures e ir substituindo as fixtures por
   chamadas reais à medida que as fases avançam.** É a opção mais tentadora e a
   pior. O protótipo passa a ser a linha principal, e a partir daí qualquer
   coisa que ele já faça deixa de ser questionada. Como não existe camada de
   dados, "substituir as fixtures" significa editar os 9 ecrãs um a um, e nesse
   processo a Fase 5 é feita a conta-gotas antes da Fase 1. Também torna o
   protótipo indeletável: ao fim de duas semanas ninguém sabe que partes são
   referência visual e que partes são produto.
3. **Congelar em `app/` com um aviso no topo de cada ficheiro.** Um comentário
   não é um mecanismo. Continua a compilar, continua no `typecheck`, continua a
   ser a primeira coisa que qualquer agente vê ao abrir o repositório, e o
   `mobile-engineer` da Fase 5 vai partir dele por inércia.
4. **Preservar só como imagens ou como branch git.** Deletável ao máximo, mas
   deixa de ser inspeccionável e de compilar, e a direcção visual perde-se em
   detalhes de espaçamento e tipografia que uma captura de ecrã não conserva.
5. **Quarentena: mover para `proto/`, fora do `tsconfig`, fora do CI e fora da
   raiz do Expo Router, com um script dedicado para o correr.**

## Decisão

Adopta-se a stack fixada no `CLAUDE.md`, com as escolhas A1, B1, C1, D1 e E1
pelas razões acima. Nenhuma delas é revista antes do fim da Fase 2 sem novo ADR.

Fronteiras que decorrem da stack e que passam a ser vinculativas:

- As regras 1, 2 e 3 são políticas RLS. Nenhum `.select()` no cliente e nenhuma
  Edge Function podem ser a razão pela qual um dado não aparece. Se remover
  todo o código de cliente e atacar o PostgREST directamente com um JWT válido
  de outro utilizador, o resultado tem de continuar a ser vazio.
- O TMDB é falado exclusivamente por Edge Function. A chave nunca entra no
  bundle.
- O motor de ranking (Fase 3) não importa React, rede nem Supabase.
- `supabase/migrations/` tem dono único: `db-architect`.

Quanto ao protótipo, escolhe-se a **opção F5, quarentena em `proto/`**, por ser
a mais fácil de apagar depois — critério explícito de desempate deste projecto.
Concretamente:

- `app/`, `src/components/`, `src/data/fixtures.ts`, `src/ranking/derive.ts` e
  `src/ranking/derive.test.ts` passam para `proto/` preservando a estrutura
  interna.
- `proto/` sai do `include` do `tsconfig.json`, sai do glob do Vitest, sai do
  lint bloqueante e sai do pipeline de CI.
- A raiz do Expo Router passa a ser um `app/` novo e mínimo: um `_layout.tsx` e
  um `index.tsx` de placeholder, ambos já a usar `src/theme` e `src/i18n`, para
  satisfazer o critério da Fase 0 de a app arrancar em iOS e Android.
- O protótipo continua a poder ser corrido com um script `npm run proto`, que
  aponta a raiz do router para `proto/app`. É referência visual viva, não
  produto.
- `src/theme/` e `src/i18n/` **não** vão para quarentena. Ficam na linha
  principal porque as proibições permanentes do `CLAUDE.md` — nada de strings
  literais em componentes, nada de valores de estilo fora dos tokens — exigem
  que existam desde o primeiro ecrã. Ficam marcados como provisórios e o
  `design-system-keeper` tem mandato explícito para os re-derivar na Fase 5 a
  partir da direcção visual aprovada.
- Apagar o protótipo, quando chegar a altura, é apagar a pasta `proto/`, o
  script `proto` no `package.json` e a linha de exclusão no `tsconfig.json`.
  Três acções, zero arqueologia.

Se o script `npm run proto` se revelar frágil por causa da resolução da raiz do
Expo Router, o recuo é degradar `proto/` a referência estática — os ficheiros
mantêm-se, deixam de ser executáveis, a direcção visual continua legível. Não é
motivo para reverter a quarentena.

## Consequências

Positivas:

- A ordem das fases volta a ser verdadeira. A partir daqui, a primeira coisa
  que existe na linha principal é o esquema.
- O `rls-adversary` pode atacar sem que ninguém alegue que "na app isso não
  aparece". Não há app.
- O trabalho visual não se perde e continua a compilar e a correr sob procura.
- O custo de apagar o protótipo é conhecido, pequeno e permanece pequeno com o
  tempo, porque a quarentena impede que ganhe dependências novas.

Negativas, assumidas:

- Durante as Fases 1 e 2 o `npm start` mostra um placeholder. É desconfortável
  e é suposto ser: comunica o estado real do projecto.
- O `typecheck` deixa de cobrir o protótipo. Ele vai apodrecer face às
  bibliotecas. Aceite — é referência visual, não código a manter.
- `src/theme/` e `src/i18n/` ficam na linha principal antes de o
  `design-system-keeper` ter feito o seu trabalho de Fase 5. Risco real de os
  tokens actuais se cristalizarem por inércia. Mitigação: registado como dívida
  em `docs/plano/fase-0-1.md`, com re-derivação obrigatória na Fase 5.
- `src/ranking/derive.ts` foi escrito fora do `ranking-engineer` e implementa
  uma interpolação linear que **não** é o algoritmo do produto (baldes
  Adorei/Gostei/Nah com intervalos 8.0-10.0, 5.0-7.9, 0.0-4.9). Vai para
  quarentena precisamente para não ser confundido com o motor. O
  `ranking-engineer` começa da folha em branco na Fase 3 e não é obrigado a
  respeitar a assinatura actual.
- A quarentena custa uma configuração de build extra (script `proto`,
  exclusões). Custo pago uma vez, na Fase 0.
