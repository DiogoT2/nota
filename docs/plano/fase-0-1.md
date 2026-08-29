# Fases 0 e 1 — decomposição em tarefas

Documento de trabalho. Fonte das caixas: `.claude/PLAN.md`. Fonte das decisões
de stack e do destino do protótipo: `docs/adr/0001-stack.md`.

Cada tarefa tem: identificador, agente responsável, artefactos, critério de
aceitação verificável e dependências. Uma tarefa sem critério verificável não
entra nesta lista.

---

## Fase 0 — Fundações

### F0-1 · Repositório e higiene · `tech-lead`

Artefactos: `.git/`, `.gitignore` (já existe, rever), `.editorconfig`,
`eslint.config.js`, `.prettierrc`, `.husky/pre-commit`, `package.json`
(scripts `lint`, `format`).

O repositório ainda **não** é um repositório git. É o primeiro comando.

Critério: `git status` responde; `npm run lint` e `npm run typecheck` passam
num clone limpo; um commit com um erro de lint é recusado pelo pre-commit.

Dependências: nenhuma. É a primeira tarefa do projecto.

### F0-2 · Quarentena do protótipo · `mobile-engineer`

Executa a decisão F5 do ADR 0001.

Artefactos: `proto/app/**`, `proto/components/**`, `proto/data/fixtures.ts`,
`proto/ranking/derive.ts` e `.test.ts`; `app/_layout.tsx` e `app/index.tsx`
novos e mínimos; `tsconfig.json` com `proto` excluído; `vitest.config.ts` com
`proto` fora do glob; script `proto` no `package.json`.

`src/theme/` e `src/i18n/` **ficam onde estão**. Não são quarentena.

Critério: `npm run typecheck` não vê um único ficheiro de `proto/`;
`npm test` corre zero testes de `proto/`; `npm start` arranca no placeholder;
`npm run proto` arranca o protótipo. Apagar o protótipo é `rm -rf proto/` mais
duas linhas — verificado à mão.

Dependências: F0-1.

### F0-3 · Supabase local · `db-architect`

Artefactos: `supabase/config.toml`, `supabase/seed.sql` (esqueleto),
scripts `db:start`, `db:reset`, `db:diff`.

Critério: `npx supabase start` sobe Postgres, PostgREST, Auth e Studio;
`db:reset` recria a base do zero de forma reprodutível e determinista (correr
duas vezes dá a mesma base, incluindo os UUID das contas de teste).

Dependências: F0-1.

### F0-4 · Contas de teste e seed adversarial · `db-architect`

Pré-requisito da bateria do `rls-adversary`. Ver `docs/ataque-fase-1.md`,
secção "Pré-requisitos".

Artefactos: `supabase/seed.sql` com seis contas fixas de UUID conhecido —
`ana` (pública), `bruno` (privado), `carla` (privada, no Círculo da ana),
`david` (segue a ana em `pending`), `eva` (bloqueada pela ana), `fabio`
(estranho, sem relação com ninguém).

Critério: cada conta tem um JWT obtenível por script (`scripts/token.sh <handle>`)
e o `rls-adversary` autentica-se como qualquer uma sem passar pela app.

Dependências: F0-3, F1-1.

### F0-5 · Segredos e verificação de bundle · `tech-lead`

Artefactos: `.env.example`, `.env` no gitignore (confirmar), documentação das
variáveis, script `check:secrets`.

Critério: o script falha se `TMDB_API_KEY` ou a chave `service_role` aparecerem
num bundle exportado (`npx expo export` seguido de grep sobre o output). Corre
no CI. Proibição permanente do `CLAUDE.md` — nunca é opcional.

Dependências: F0-1.

### F0-6 · CI · `tech-lead`

Artefacto: `.github/workflows/ci.yml`.

Critério: um PR corre lint, typecheck, Vitest, `supabase start` + pgTAP e
`check:secrets`. Um teste pgTAP a falhar bloqueia o merge. Zero chamadas reais
ao TMDB no CI.

Dependências: F0-1, F0-3, F0-5.

### F0-7 · Ambientes · `tech-lead`

Critério: três projectos Supabase distintos (local, staging, produção), com
chaves separadas e documentados; a produção nunca é alvo de `db:reset` —
o script recusa-se a correr se a URL não for local ou de staging.

Dependências: F0-3.

**Aceitação da Fase 0:** um programador novo clona, corre
`npm install && npm run db:start && npm start` e tem tudo a funcionar. Testado
num clone limpo, não na máquina de quem escreveu.

---

## Fase 1 — Esquema e RLS

Dono único de `supabase/migrations/`: `db-architect`. Veto: `rls-adversary`.

### F1-0 · Desenho antes do SQL · `db-architect`

Artefacto: `docs/esquema-fase-1.md`.

Critério: cobre as 14 tabelas, a exposição da nota derivada, a numeração de
`rank_positions`, o mecanismo do limite de 30 à prova de concorrência, o esboço
de RLS por tabela e a lista de índices com a query que cada um serve. Revisto
pelo `tech-lead` antes de existir uma linha de SQL.

Dependências: nenhuma.

### F1-1 · Migração base · `db-architect`

Tabelas sem dependência do grafo social: `profiles`, `titles`, `seasons`,
`episodes`, `watched`.

Critério: `profiles.is_private` tem default `true` — testado em pgTAP, não lido
no ficheiro. Migração reversível: `up` seguido de `down` devolve a base ao
estado anterior, verificado por diff de esquema.

Dependências: F1-0, F0-3.

### F1-2 · Grafo social · `db-architect`

`follows` (estado `pending | active`), `circle_members`, `blocks`, `reports`.

Critério: a reciprocidade do Círculo e o limite de 30 são impostos no motor.
Teste pgTAP com duas transacções concorrentes a inserir o 30.º e o 31.º membro:
uma commita, a outra falha. Um `follow` entre contas bloqueadas é impossível.

Dependências: F1-1.

### F1-3 · Ranking e nota derivada · `db-architect`

`buckets`, `rank_positions`, `taste_match`.

Critério: unicidade por `(user_id, subject_type, scope_id)` na posição; **nenhuma
coluna de nota em nenhuma tabela** — grep sobre `supabase/migrations/` não
encontra `score`, `rating` ou `nota` fora da vista ou função de derivação.
Regra 4 do produto, imposta pela estrutura e não pela disciplina.

Dependências: F1-1.

### F1-4 · Interacção · `db-architect`

`reactions`, `replies` com limite de 140 caracteres em `CHECK`.

Critério: um `INSERT` directo no PostgREST com 141 caracteres é recusado pelo
Postgres, não pelo cliente.

Dependências: F1-2, F1-3.

### F1-5 · Políticas RLS · `db-architect`

Critério, cada um com teste pgTAP próprio:

- RLS activo em todas as tabelas com dados de utilizador, sem excepção — teste
  que percorre `pg_class` e falha se alguma tabela não tiver `relrowsecurity`.
- Ler notas de um título exige bucket próprio para esse título.
- Ler qualquer coisa de perfil privado exige `follows.state = 'active'`.
- Ler notas de episódio exige Círculo **e** `watched` para esse episódio.
- Bloqueio anula tudo o acima, nos dois sentidos.
- Escrita restrita ao próprio `user_id` em todas as tabelas.

Dependências: F1-1 a F1-4.

### F1-6 · Índices · `db-architect`

Critério: cada índice tem, no documento, a query que serve e um `EXPLAIN` que o
mostra a ser usado. Índices que o `EXPLAIN` não usa são apagados, não guardados
por precaução.

Dependências: F1-5.

### F1-7 · ADR por `security definer` · `tech-lead` + `db-architect`

Critério: cada função `security definer` tem ADR próprio com a razão de não
poder ser `security invoker` e o que acontece se for mal usada. Zero funções sem
ADR — verificado por script no CI.

Dependências: F1-5.

### F1-8 · Bateria de ataque · `rls-adversary`

Artefactos: `docs/ataque-fase-1.md` (preparação, feita antes) e relatório com
veredicto global.

Critério: os 13 ataques do PLAN.md, mais os vectores adicionais, falham todos.
Uma única falha bloqueia a fase.

Dependências: F1-5, F1-6, F0-4.

**Aceitação da Fase 1:** todos os ataques falham. Veredicto escrito do
`rls-adversary`.

---

## Ordem de execução

```
F0-1 ─┬─ F0-2  (quarentena do protótipo)
      ├─ F0-5 ─┐
      ├─ F0-3 ─┼─ F0-6  (CI)
      │        └─ F0-7
      │
F1-0 ─┴─ F1-1 ─┬─ F1-2 ─┐
               ├─ F1-3 ─┼─ F1-4 ─ F1-5 ─┬─ F1-6 ─┬─ F1-8  (veto)
               └─ F0-4 ─────────────────┴─ F1-7 ─┘
```

F1-0 arranca em paralelo com toda a Fase 0 — é escrita, não código. Nada a
jusante de F1-8 arranca antes do veredicto.

---

## Dívida assumida

1. **Protótipo de UI adiantado.** Existem 12 ecrãs de aparência de Fase 5 antes
   das Fases 0 a 2. Vão para `proto/` em F0-2. Reconciliação: na Fase 5 o
   `mobile-engineer` não parte de `proto/`, parte dos requisitos; `proto/` é
   consultado como referência visual e apagado no fecho da Fase 5.
2. **`src/theme/` e `src/i18n/` na linha principal antes da Fase 5.** Ficam
   porque as proibições permanentes exigem tokens e i18n desde o primeiro ecrã.
   Estão marcados como provisórios. O `design-system-keeper` tem mandato para os
   re-derivar na Fase 5 sem retrocompatibilidade.
3. **`derive.ts` não é o motor.** Interpolação linear entre 9.5 e 7.8, escrita
   fora do `ranking-engineer`, sem baldes. Vai para quarentena. O
   `ranking-engineer` começa da folha em branco e não é obrigado a manter a
   assinatura actual.
4. **Sem git.** Todo o trabalho até F0-1 não tem histórico. Custo pago uma vez.

---

## Decisões em aberto — não decidir sozinho

Herdadas do PLAN.md e ainda por fechar:

- Feed limitado ao Círculo, ou duas tabs (Círculo e A seguir)? Afecta os índices
  de F1-6 e o desenho de `follows`. **Precisa de resposta antes de F1-6.**
- Notas de episódio sempre restritas ao Círculo, mesmo em perfil público?
  Afecta directamente a política RLS de F1-5. **Precisa de resposta antes de F1-5.**
- Nome definitivo da app.
- Estratégia de arranque: teste com 10 pessoas antes de continuar a construir?

Acrescentadas por esta decomposição:

- **Retenção de `reports` e do registo de auditoria de moderação.** Afecta o
  esquema de F1-2 e as etiquetas de privacidade da App Store. **Precisa de
  resposta antes de F1-2.**
- **Eliminação de conta: apagar ou anonimizar?** Requisito da Apple. Determina
  se as chaves estrangeiras são `ON DELETE CASCADE` ou `SET NULL` — decisão de
  F1-1 e cara de mudar depois. **Precisa de resposta antes de F1-1.**
