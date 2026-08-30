# Ataque à Fase 3

Veredicto de veto sobre o fecho da Fase 3, pedido pelo `tech-lead`.

O que a Fase 3 mexeu no esquema está em
`supabase/migrations/20260830090000_ranking.sql`: a coluna
`rank_positions.pinned`, a recriação da vista `public.scores` e a recriação da
política `taste_match_ler` com `overlap >= 10`. É sobre isso que este documento
incide — a bateria da Fase 1 foi corrida na mesma, inteira, para confirmar que
nada regrediu.

Todos os ataques são chamadas HTTP directas ao PostgREST com a chave `anon` e um
JWT emitido por `scripts/token.mjs`. Nunca através da app. `service_role` só
aparece a montar terreno e a estabelecer a verdade contra a qual se mede.

Ambiente: base local, `supabase db reset` imediatamente antes de cada corrida.
As sete migrações aplicadas, incluindo `20260830090000`.

---

## 1. A bateria existente

| Comando                  | Resultado verdadeiro                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| `npm run db:ataque:rest` | 26 ataques, 0 bem sucedidos contra nós                                  |
| `npm run db:ataque`      | 20/20 rondas: exactamente uma transacção passou, o Círculo ficou com 30 |
| `npx supabase test db`   | 59/59, `Result: PASS` — **com a base acabada de repor**                 |

### Um falso negativo que eu próprio produzi

À primeira corrida, o pgTAP deu `Result: FAIL`, com 5 testes a falhar:

```
020-visibilidade-circulo.sql  testes 10, 11, 13, 14
030-escrita.sql               teste 9
```

Não é defeito do esquema. Foi ordem de execução minha: corri `npm run db:ataque`
antes do pgTAP. Isolei a causa correndo as coisas separadas:

```
supabase db reset ; supabase test db                    -> PASS (59/59)
supabase db reset ; db:ataque:rest ; supabase test db   -> PASS (59/59)
supabase db reset ; db:ataque      ; supabase test db   -> FAIL (5 testes)
```

`scripts/ataque-limite-circulo.mjs` limpa o Círculo da ana e enche-o com 30
membros sintéticos, e não repõe o seed. Os testes que afirmam «a carla está no
Círculo da ana» e «o Círculo chega aos 30» falham a partir daí. A bateria REST,
essa, é auto-reparadora — verificado acima.

Consequência operacional, sem ser buraco de segurança: a suite de aceitação da
fase depende da ordem e dá um `FAIL` falso a quem a correr pela ordem errada.
Registado; não bloqueia.

---

## 2. A vista `scores`

### 2.1 `security_invoker` na base, não no ficheiro

```
docker exec -i supabase_db_nota psql -U postgres -d postgres -c \
  "select c.relname, c.reloptions, pg_get_userbyid(c.relowner)
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v';"
```

```
    relname    |      reloptions       |   dono
---------------+-----------------------+----------
 profile_cards |                       | postgres
 scores        | {security_invoker=on} | postgres
```

O `drop` e o `create` repetiram a propriedade. `security_invoker=on` está mesmo
activo na vista que existe agora. A `profile_cards` continua sem ele, que é a
abertura deliberada e auditada da Fase 1.

Os privilégios também sobreviveram: `authenticated` tem `SELECT` sobre `scores`,
herdado das default privileges do Supabase. A vista não ficou inacessível, e
como corre como invocador continua a ser filtrada pelas políticas de
`rank_positions` e `buckets`.

**PASSA.**

### 2.2 A nota cega através da vista

| #   | Ataque                                                                                    | Resultado                                                                      | Veredicto                     |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| F1  | `GET scores?select=*` como fabio, que não avaliou nada                                    | `200 []`                                                                       | PASSA                         |
| F2  | `HEAD scores?subject_id=eq.<filme>` com `Prefer: count=exact`                             | `content-range: */0`                                                           | PASSA                         |
| F3  | `GET scores?select=subject_id,score&order=score.desc&limit=20`                            | `200 []`                                                                       | PASSA                         |
| F4  | avaliar, ler o alvo, apagar a avaliação, voltar a ler                                     | com balde: 1 nota alheia (ana, 9.0 — leitura legítima); depois de apagar: `[]` | PASSA                         |
| F5  | eva, bloqueada pela ana, lê `scores?user_id=eq.<ana>`                                     | `200 []`                                                                       | PASSA                         |
| F6  | david, que segue a ana mas está fora do Círculo, lê `scores` de episódio dela             | `200 []`                                                                       | PASSA                         |
| F7  | fabio, já com balde no mesmo filme, lê `scores?user_id=eq.<bruno>` (privado, sem relação) | `200 []`                                                                       | PASSA                         |
| F8  | escrever a nota: `PATCH scores` e `POST scores`                                           | `500 · 55000 «Views containing WITH are not automatically updatable»`          | PASSA                         |
| F23 | ler `scores` com a chave `anon`, sem sessão                                               | `200 []`                                                                       | PASSA                         |
| F24 | ler `rank_positions` por GraphQL                                                          | `pg_graphql extension is not enabled`                                          | PASSA, superfície inexistente |

F4 é o cenário que interessa e o resultado é o certo: a nota da ana só aparece
enquanto o fabio tem balde próprio para o mesmo filme, e desaparece no instante
em que ele o apaga. A vista recriada não guarda nada por si.

Nota sobre o F8: a recusa vem com `500` e não com `4xx`. Não é fuga — a mensagem
é sobre a forma da vista, não sobre dados — mas é um código de estado que mente
sobre a natureza do erro.

**PASSA.**

---

## 3. `pinned`

### 3.1 Escrita

| #    | Ataque                                                                                          | Resultado                                                  | Veredicto |
| ---- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------- |
| F9   | `PATCH rank_positions?user_id=eq.<ana>` com `{pinned:true}`, como david                         | `200 []`, zero linhas da ana pregadas                      | PASSA     |
| F10  | o mesmo, filtrando pelo `id` exacto da linha da ana                                             | `200 []`, valor real continua `false`                      | PASSA     |
| F11  | `PATCH rank_positions?pinned=eq.false` sem filtro de dono, como david                           | tocou 2 linhas, ambas do próprio; zero alheias             | PASSA     |
| F12  | upsert com a chave única real sobre linha da ana                                                | `403 · 42501`, **idêntico** ao de uma linha que não existe | PASSA     |
| F12b | upsert `merge-duplicates` na própria linha, a ver se arrasta alheias                            | 0 linhas alheias pregadas                                  | PASSA     |
| F12c | oráculo pela chave `(user_id,subject_type,scope_id,position)`: posição ocupada vs. livre da ana | `403` e corpo idênticos nos dois casos                     | PASSA     |
| F27  | `PATCH` na própria linha a mudar `user_id` para a ana, com `pinned:true`                        | `403 · 42501`                                              | PASSA     |
| F28  | `INSERT` em nome da ana com `pinned:true`                                                       | `403 · 42501`                                              | PASSA     |
| F29  | `DELETE rank_positions?user_id=eq.<ana>`                                                        | a ana continua com as 6 linhas                             | PASSA     |

A política de `UPDATE` existente aguenta a coluna nova, incluindo por `id` de
linha e por `PATCH` em massa. O `WITH CHECK` fecha a mudança de dono.

> Correcção a um ataque meu, para não ficar a contar como defesa: a primeira
> versão do F12 usava `on_conflict=user_id,subject_type,subject_id`, que **não é**
> uma restrição de `rank_positions`, e devolvia `400 · 42P10 «there is no unique
or exclusion constraint matching»`. Era o meu ataque a não chegar sequer à RLS.
> Repetido com a chave verdadeira, `(user_id, subject_type, scope_id,
subject_id)`, e aí sim: `403`.

### 3.2 `pinned` como oráculo

| #    | Ataque                                                                           | Resultado                                                     | Veredicto |
| ---- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------- |
| F13  | `HEAD rank_positions?pinned=eq.true` e `=eq.false` com `count=exact`, como fabio | `*/0` nos dois                                                | PASSA     |
| F13b | david filtra por `pinned` sobre as linhas da ana                                 | vê 1 de 6 linhas — a única que a nota cega já lhe deixava ver | PASSA     |

A RLS filtra as linhas antes de o filtro por `pinned` se aplicar. Não há
contagem, ordenação nem filtro por `pinned` que faça aparecer uma linha que não
apareceria de outro modo. `pinned` não é oráculo de nada.

### 3.3 Onde é que `pinned` aparece

| #    | Superfície                                                                             | Resultado                                                                                                        |
| ---- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F22  | `scores?select=*`                                                                      | `user_id, subject_type, scope_id, subject_id, bucket, position, pinned, created_at, score`                       |
| F14  | `scores` e `rank_positions` de uma nota de terceiro que posso legitimamente ler        | `pinned` vem no corpo, com o valor verdadeiro                                                                    |
| F15  | embeds `profiles(rank_positions(pinned))`, `replies(...)`, `reactions(...)` como fabio | `profiles`: array embebido vazio. `replies` e `reactions`: `400 · PGRST200`, não há relação de chave estrangeira |
| F15b | `scores?select=*,profiles(handle)` e `watched?select=*,rank_positions(pinned)`         | `200 []` e `400 · PGRST200`                                                                                      |
| F25  | `scores?order=pinned.desc,score.desc` como david                                       | só as linhas que ele já podia ver                                                                                |

**Não há aqui quebra de política**, e é preciso ser exacto: `pinned` nunca
aparece numa linha que o leitor não pudesse ler à mesma. Aparece nas linhas que
ele pode ler — e aí conta-lhe uma coisa que a Fase 1 não contava.

O que conta é que aquela pessoa arrastou aquele título à mão. É estado interno do
motor de ranking (decisão D2 de `docs/plano/fase-3.md`) e passou a estar visível
a toda a gente que tenha avaliado o mesmo título. Para o utilizador significa que
alguém pode ver quais das suas notas ele forçou, em vez de as ter deixado sair da
comparação. Não viola nenhuma das quatro regras de produto; é superfície nova,
sem um único teste a cobri-la, e devia ser decisão tomada e não efeito secundário
do `select` da vista.

**PASSA**, com a observação registada.

---

## 4. `taste_match` com `overlap >= 10`

Política verdadeira na base, lida de `pg_policy`:

```
taste_match_ler | ((((user_a = (SELECT auth.uid())) AND in_my_circle(user_b))
                 OR ((user_b = (SELECT auth.uid())) AND in_my_circle(user_a)))
                 AND (overlap >= 10))
```

| #    | Ataque                                                                            | Resultado                                                                                      | Veredicto |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------- |
| F16  | com `overlap` forçado a 50, fabio, david, bruno e eva lêem `taste_match?select=*` | `200 []` para os quatro                                                                        | PASSA     |
| F20  | david: `HEAD` com `count=exact`, e agregação `overlap.avg(),affinity.max()`       | `*/0`; agregação `400 · PGRST123 «Use of aggregate functions is not allowed»`                  | PASSA     |
| F20b | david compara o par que existe (ana,carla) com um que não existe (ana,bruno)      | `200 []` idêntico nos dois                                                                     | PASSA     |
| F19  | linha (ana,eva) com `overlap` 40, havendo bloqueio                                | ana: `[]`; eva: `[]`                                                                           | PASSA     |
| F21  | ana escreve a sua própria percentagem: `INSERT`, `PATCH`, `DELETE`                | `INSERT 403`; `PATCH 204` e `DELETE 204` sem tocar em linha nenhuma; `overlap` real continua 6 | PASSA     |

A percentagem continua inacessível a quem não é do Círculo, mesmo com
sobreposição alta. O `overlap >= 10` não abriu nada: está em `AND` com o
`in_my_circle`, e é o `in_my_circle` que faz o trabalho.

### 4.1 O oráculo dos 9 vs 10 existe — e não é uma fuga

```
F18  overlap=9  -> 200 []
     overlap=10 -> 200 [{"overlap":10,"affinity":0.812}]
```

A linha aparece e desaparece conforme o limiar, e um membro do Círculo consegue
portanto distinguir «temos 9 títulos em comum» de «temos 10».

Não conta como falha, e a razão é aritmética e não retórica: quem vê a linha vê
a coluna `overlap` inteira, com o número exacto. A política anterior, com o
limiar em 5, mostrava a esse mesmo membro do Círculo o valor exacto a partir de 5. O limiar novo **retira** informação — o que era «sei que são 9» passou a «sei
que são menos de 10». O predicado não criou superfície; fechou-a. E para quem
está fora do Círculo nem a presença nem a ausência da linha é observável, com
qualquer valor de `overlap` (F16).

**PASSA.**

### 4.2 O que o limiar partiu foi o teste, não a política

O seed tem uma única linha de `taste_match`, com `overlap = 6`
(`supabase/seed/20-grafo.sql`). Com o limiar em 10, essa linha deixou de ser
visível para toda a gente, incluindo a ana e a carla, que são Círculo mútuo:

```
F18b  ana: []   carla: []
```

Duas consequências, ambas de cobertura:

1. **Nenhum teste exercita hoje uma leitura bem sucedida de `taste_match`.** Não
   há um único teste pgTAP que mencione `taste_match` — procurado em
   `supabase/tests/` — e a linha do seed que servia o caminho de leitura caiu
   abaixo do limiar. Se `taste_match_ler` for largada por engano numa migração
   futura, nada nesta suite dá por isso.
2. **Os ataques A15 e A16 da bateria REST passaram a ser vácuo na linha do
   `taste_match`.** Ambos percorrem uma lista de superfícies à procura de fugas
   ao bloqueio, e `taste_match` é uma delas. Essa entrada devolve zero linhas
   agora por causa do `overlap`, não por causa do bloqueio. Continua a marcar
   verde, e deixou de estar a testar o que diz que testa.

O bloqueio em si está verificado — é o que o F19 faz, com `overlap` a 40 de
propósito. Mas foi um ataque escrito hoje que o verificou, não a bateria que
ficou no repositório.

---

## 5. Regra 4, de passagem

| #   | Ataque                                                                | Resultado                                                                        |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| F26 | david faz `PATCH rank_positions` na própria linha a pôr `position: 7` | `204`. A nota derivada não muda — é o único título naquele balde, fica no centro |

Não há trigger nenhum em `rank_positions` (`pg_trigger`: zero linhas não
internas), e `authenticated` tem `UPDATE` sobre todas as colunas, `position` e
`pinned` incluídas. Um utilizador pode portanto escrever posições directamente,
sem passar por comparação nenhuma.

Não é fuga: são dados do próprio, ninguém mais é afectado, e a nota continua a
ser derivada — a vista não aceita escrita (F8), e a regra 4 diz que a nota não se
escreve, não que a ordem não se escreve. O arrasto, aliás, é exactamente isto.
Fica registado por ser a fronteira exacta da regra, e vai voltar quando alguém
propuser um endpoint de import (Fase 7).

---

## 6. Fora de âmbito nesta corrida

- **Realtime.** Configuração separada, não coberta aqui, tal como na Fase 1.
- **Segunda conta no mesmo dispositivo** para reaparecer depois de um bloqueio.
  Não é resolúvel em RLS e não é matéria da Fase 3.
- **Oráculos de latência.** Precisam de volume de dados que o seed não tem.

---

## Veredicto

**POSITIVO.** A Fase 3 pode ficar fechada.

Corri os 26 ataques da bateria existente, as 20 rondas do ataque ao limite do
Círculo, os 59 testes pgTAP e 24 ataques novos escritos contra as três
alterações desta fase. **Nenhum ataque foi bem sucedido.** `security_invoker =
on` está activo na vista que existe na base, a nota cega aguenta através da
`scores` recriada, `pinned` não se escreve em linha alheia nem serve de oráculo,
e a percentagem de `taste_match` continua fechada a quem não é do Círculo.

Três dívidas registadas. Nenhuma é uma fuga; todas são para tratar antes de a
Fase 4 mexer no que lhes diz respeito:

1. **`taste_match` ficou sem cobertura viva.** O limiar de 10 tornou invisível a
   única linha do seed (`overlap = 6`), e com ela o caminho de leitura legítimo.
   As entradas de `taste_match` em A15 e A16 passaram a marcar verde por vácuo.
2. **`pinned` é superfície nova, sem teste e sem decisão.** Aparece em
   `scores?select=*` e em `rank_positions?select=*` para qualquer pessoa que já
   possa ler aquela nota, e revela que o título foi arrastado à mão.
3. **A suite de aceitação depende da ordem.** `npm run db:ataque` deixa a base
   suja e o pgTAP a seguir dá `FAIL` em 5 testes. Quem correr por essa ordem lê
   um veredicto falso.

Quem escreve as políticas e os testes é o `db-architect`. Este documento não
propõe correcções, só diz o que está lá.
