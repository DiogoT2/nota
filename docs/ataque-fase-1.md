# Fase 1 — bateria de ataque às políticas RLS

Preparada antes de existir base de dados. Corre no momento em que o
`db-architect` entregar F1-5. Não há aqui sugestões de correcção — só ataque e
critério. Corrigir é trabalho de quem escreveu o esquema.

Referência do desenho a atacar: `docs/esquema-fase-1.md`.

---

## Pré-requisitos

Sem isto a bateria não corre. Pedido formal ao `db-architect` (tarefa F0-4):

1. PostgREST local acessível em `$SUPABASE_URL/rest/v1`, com o esquema de F1-5
   aplicado por `db:reset` a partir do zero.
2. `SUPABASE_ANON_KEY` para o header `apikey`.
3. `SUPABASE_SERVICE_KEY` — usada **apenas** para montar estado e para confirmar
   a verdade da base. Nunca para atacar. Um ataque que precise dela não é ataque.
4. `scripts/token.sh <handle>` que devolve um JWT válido de cada conta de teste.
5. Seed determinista com seis contas de UUID fixo e conhecido:

   | conta   | perfil  | relação com `ana`                         |
   | ------- | ------- | ----------------------------------------- |
   | `ana`   | pública | —                                         |
   | `bruno` | privado | não segue ninguém                         |
   | `carla` | privada | Círculo mútuo com `ana`                   |
   | `david` | público | segue `ana` em `pending` para com `bruno` |
   | `eva`   | pública | bloqueada por `ana`                       |
   | `fabio` | público | estranho, sem relação nenhuma             |

6. Estado de dados no seed: `ana`, `carla` e `bruno` avaliaram o filme `T1`;
   só `ana` e `carla` avaliaram o episódio `E1`; `fabio` não avaliou nada;
   `carla` viu `E1`, `fabio` não.
7. A bateria corre contra uma base acabada de recriar. Um ataque que deixe estado
   sujo invalida os seguintes — cada ataque limpa o que criou, ou a base é
   reposta entre grupos.

Convenção dos exemplos:

```sh
A=$(scripts/token.sh ana); F=$(scripts/token.sh fabio)
H_ANON="apikey: $SUPABASE_ANON_KEY"
```

---

## Grupo 1 — Nota cega

### A1 · Ler posição alheia sem ter avaliado

Objectivo: `fabio`, que não avaliou `T1`, lê a nota da `ana` para `T1`.

Montagem: seed base. `fabio` sem bucket para `T1`.

```sh
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$T1&select=*"
```

Esperado: `[]`. O mesmo contra `/buckets` e `/scores`.

Falha: qualquer linha da `ana` ou da `carla`.

### A2 · Inferir por `count=exact`

Objectivo: sem avaliar, descobrir **quantas** pessoas avaliaram `T1`.

```sh
curl -s -I -H "$H_ANON" -H "Authorization: Bearer $F" \
  -H "Prefer: count=exact" -H "Range: 0-0" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$T1&select=id"
```

Esperado: `Content-Range: */0`.

Falha: qualquer `*/N` com `N > 0`. Repetir com `count=planned` e
`count=estimated` — a estimativa vem do planeador e pode não respeitar o filtro.

### A3 · Inferir por ordenação

Objectivo: usar `?order=position.asc` e a ordem do resultado como canal.

```sh
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$T1&order=position.asc&select=id"
```

Esperado: `[]`. Também com `order=user_id`, e com `limit=1&offset=N` a variar `N`
— se o `offset` mudar o resultado, há linhas por trás do filtro.

### A4 · Inferir por mensagens de erro

Objectivo: distinguir "título que não existe" de "título que existe mas não posso ver".

```sh
for id in "$T1" "00000000-0000-0000-0000-0000000000ff"; do
  curl -s -o /dev/null -w "%{http_code} " -H "$H_ANON" -H "Authorization: Bearer $F" \
    "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$id&select=*"
done
```

Esperado: os dois códigos e os dois corpos idênticos.

Falha: `404` num e `200 []` no outro, ou corpos de erro com detalhe diferente.
Medir também a latência: 20 pedidos de cada, comparar medianas. Uma diferença
sistemática é o mesmo oráculo por outro canal.

### A5 · Avaliar, ler, apagar, voltar a ler

Objectivo: usar o bucket como chave descartável.

Passos: `fabio` insere bucket para `T1`; lê `rank_positions` de `T1`; apaga o
bucket; lê outra vez.

```sh
curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $F" -H "Content-Type: application/json" \
  -d '{"subject_type":"movie","subject_id":"'$T1'","bucket":"gostei"}' \
  "$SUPABASE_URL/rest/v1/buckets"
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$T1"   # legítimo, deve ver
curl -s -X DELETE -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/buckets?subject_id=eq.$T1"
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_id=eq.$T1"   # tem de voltar a []
```

Esperado: a terceira leitura devolve `[]`.

Nota de veredicto: que as notas já lidas não possam ser "desvistas" é um limite
do modelo, não uma falha de RLS. É **aviso**, não falha, e fica registado como
decisão de produto (custo em apagar avaliações). A falha é a leitura pós-apagar
continuar a funcionar.

---

## Grupo 2 — Visibilidade de perfil

### A6 · Perfil privado com follow em `pending`

`david` tem `follows(david -> bruno)` em `pending`. Lê tudo o que for de `bruno`.

```sh
D=$(scripts/token.sh david)
for t in profiles buckets rank_positions watched replies reactions; do
  curl -s -H "$H_ANON" -H "Authorization: Bearer $D" \
    "$SUPABASE_URL/rest/v1/$t?user_id=eq.$BRUNO&select=*"
done
```

Esperado: `[]` em todas, excepto o cartão mínimo em `profile_cards` (`handle`,
`display_name`, `avatar_path`, `is_private` e mais nada).

Falha: qualquer coluna extra em `profile_cards`; qualquer linha nas outras.

### A7 · Auto-promoção de `pending` a `active`

`david` tenta aceitar o próprio pedido.

```sh
curl -s -X PATCH -H "$H_ANON" -H "Authorization: Bearer $D" -H "Content-Type: application/json" \
  -d '{"state":"active"}' \
  "$SUPABASE_URL/rest/v1/follows?follower_id=eq.$DAVID&followee_id=eq.$BRUNO"
```

Esperado: 0 linhas afectadas. Repetir com `Prefer: return=representation` para
confirmar que não devolve a linha alterada.

### A8 · Perfil privado por tabela de junção

Objectivo: chegar a `bruno` sem passar por `profiles`, via embed.

```sh
curl -s -H "$H_ANON" -H "Authorization: Bearer $D" \
  "$SUPABASE_URL/rest/v1/replies?select=*,profiles(*)&user_id=eq.$BRUNO"
curl -s -H "$H_ANON" -H "Authorization: Bearer $D" \
  "$SUPABASE_URL/rest/v1/taste_match?select=*,profiles!user_b(*)"
curl -s -H "$H_ANON" -H "Authorization: Bearer $D" \
  "$SUPABASE_URL/rest/v1/reactions?select=*,rank_positions(*)"
```

Esperado: `[]` ou embeds vazios.

Falha: dados de `bruno` a chegar por qualquer caminho. Repetir com todos os
pares de tabelas que tenham chave estrangeira entre si — o PostgREST descobre a
relação sozinho, e é isso que torna este vector fácil de esquecer.

### A9 · Distinguir "vazio" de "invisível" pela forma do embed

Objectivo: `GET /profiles?select=handle,rank_positions(id)` — um perfil presente
com array vazio significa "não avaliou"; ausente significa "não posso ver". A
diferença é informação sobre quem avaliou o quê.

Esperado: as duas situações indistinguíveis do lado do atacante.

Veredicto: **aviso** se só distinguir "não avaliou" de "não vejo o perfil";
**falha** se permitir concluir que uma pessoa específica avaliou um título
específico.

---

## Grupo 3 — Círculo e episódios

### A10 · Notas de episódio fora do Círculo

`fabio` (fora do Círculo) avalia `E1` para ter bucket próprio, marca `watched`,
e tenta ler a nota da `ana`.

```sh
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_type=eq.episode&subject_id=eq.$E1"
```

Esperado: `[]`. Ter avaliado e ter visto **não** basta — falta o Círculo.

### A11 · Notas de episódio não visto

`carla` está no Círculo da `ana` e avaliou `E2`, mas não o viu.

```sh
C=$(scripts/token.sh carla)
curl -s -H "$H_ANON" -H "Authorization: Bearer $C" \
  "$SUPABASE_URL/rest/v1/rank_positions?subject_type=eq.episode&subject_id=eq.$E2"
```

Esperado: `[]`. Círculo sem `watched` não chega. As duas condições são `AND`.

Variante: marcar `watched`, ler, desmarcar, ler outra vez — mesma lógica do A5.

### A12 · Auto-inserção no Círculo sem reciprocidade

`fabio` insere-se no Círculo da `ana`, e insere a `ana` no dele sem follow mútuo.

```sh
curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $F" -H "Content-Type: application/json" \
  -d '{"owner_id":"'$ANA'","member_id":"'$FABIO'"}' "$SUPABASE_URL/rest/v1/circle_members"
curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $F" -H "Content-Type: application/json" \
  -d '{"owner_id":"'$FABIO'","member_id":"'$ANA'"}' "$SUPABASE_URL/rest/v1/circle_members"
```

Esperado: a primeira falha por política (`owner_id <> auth.uid()`), a segunda
falha por trigger (sem follow activo nos dois sentidos).

Falha: qualquer uma passar. A segunda é a perigosa — a política deixa passar
porque o `owner_id` é o próprio, e só o trigger a trava.

### A13 · Ultrapassar o limite de 30 com escritas concorrentes

O ataque mais importante do grupo. Montar 30 candidatos com follow mútuo activo
e o Círculo da `ana` com 29 membros.

```sh
for i in $(seq 1 8); do
  curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $A" -H "Content-Type: application/json" \
    -d '{"owner_id":"'$ANA'","member_id":"'${CAND[$i]}'"}' \
    "$SUPABASE_URL/rest/v1/circle_members" &
done; wait
```

Esperado: exactamente uma inserção bem sucedida; sete erros. Verificar depois
com `service_role`: `select count(*) from circle_members where owner_id = ana`
devolve `30`, e `profiles.circle_count` também `30`.

Falha: `31` em qualquer dos dois, ou divergência entre a contagem real e o
contador. Repetir 20 vezes — uma corrida que só falha às vezes falha sempre em
produção.

### A14 · Contornar o limite pelo contador

```sh
curl -s -X PATCH -H "$H_ANON" -H "Authorization: Bearer $A" -H "Content-Type: application/json" \
  -d '{"circle_count":0}' "$SUPABASE_URL/rest/v1/profiles?id=eq.$ANA"
```

Esperado: recusado, ou coluna ignorada e valor inalterado. Confirmar o valor por
`service_role` depois.

---

## Grupo 4 — Bloqueio

### A15 · Bateria completa pós-bloqueio

`eva` está bloqueada por `ana`. Antes do bloqueio existiam follow mútuo,
Círculo, respostas e `taste_match`. Correr como `eva` e como `ana`, nos dois
sentidos, contra todas as superfícies:

```sh
E=$(scripts/token.sh eva)
for t in profiles profile_cards follows circle_members buckets rank_positions \
         scores watched reactions replies taste_match; do
  echo -n "$t: "
  curl -s -H "$H_ANON" -H "Authorization: Bearer $E" \
    "$SUPABASE_URL/rest/v1/$t?select=*" | head -c 200; echo
done
```

Esperado: zero linhas da `ana` em qualquer tabela, e zero linhas da `eva` quando
corrido como `ana`. Incluindo respostas antigas escritas antes do bloqueio, e
`taste_match` já calculado.

Falha: qualquer resíduo. Esta é a lista que a Fase 4 vai reutilizar e alargar —
manter sincronizada com a "lista escrita de todas as superfícies" do PLAN.md.

### A16 · Refazer relação depois de bloqueado

`eva` tenta seguir a `ana` outra vez, e reagir a uma nota antiga.

Esperado: recusado enquanto o bloqueio existir.

---

## Grupo 5 — Escrita

### A17 · Escrever em nome de outro `user_id`

```sh
for t in buckets rank_positions watched reactions replies reports; do
  curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $F" -H "Content-Type: application/json" \
    -d '{"user_id":"'$ANA'", ...}' "$SUPABASE_URL/rest/v1/$t"
done
```

Esperado: `WITH CHECK` recusa em todas. Repetir em `PATCH`: mudar o `user_id` de
uma linha própria para o de outra pessoa é o mesmo ataque com outra forma, e é
mais fácil de esquecer na política de `UPDATE` do que na de `INSERT`.

### A18 · Responder a conteúdo fora do Círculo

`fabio` responde a uma nota da `ana`.

Esperado: recusado. Regra 3.

### A19 · Exceder 140 caracteres

```sh
BODY=$(python -c "print('a'*141)")
curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $C" -H "Content-Type: application/json" \
  -d '{"target_type":"rating","target_id":"'$R1'","body":"'$BODY'"}' \
  "$SUPABASE_URL/rest/v1/replies"
```

Esperado: erro `23514` do Postgres (violação de `CHECK`), não erro do cliente.
Testar também 140 exacto (passa), 0 (falha), e 140 caracteres com emoji e
acentos — `length()` conta caracteres, `octet_length()` conta bytes, e usar o
segundo por engano rejeita texto português legítimo.

### A20 · Escrever numa tabela de metadados

`fabio` tenta `POST /titles` e `PATCH /taste_match`.

Esperado: recusado. Só `service_role` escreve nestas.

---

## Grupo 6 — Vectores adicionais

Fora dos 13 do PLAN.md. Acrescentados por esta preparação.

### A21 · `Prefer: return=representation` em escrita recusada

Um `INSERT` que viole a política deve falhar sem devolver representação. Um
`upsert` que colida com uma linha invisível não pode devolver essa linha.

```sh
curl -s -X POST -H "$H_ANON" -H "Authorization: Bearer $F" \
  -H "Prefer: resolution=merge-duplicates,return=representation" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"'$FABIO'","subject_type":"movie","subject_id":"'$T1'","bucket":"nah"}' \
  "$SUPABASE_URL/rest/v1/buckets?on_conflict=user_id,subject_type,subject_id"
```

Esperado: nunca dados de outro utilizador no corpo da resposta.

### A22 · Existência revelada por `on_conflict`

Um `POST` que colide com uma linha que não posso ver: erro `409` revela que ela
existe; sucesso silencioso revela que não. Testar contra `buckets`,
`rank_positions` e `circle_members`.

Veredicto: **falha** se o código de resposta permitir distinguir a existência de
uma linha de outro utilizador.

### A23 · Agregados do PostgREST

```sh
curl -s -H "$H_ANON" -H "Authorization: Bearer $F" \
  "$SUPABASE_URL/rest/v1/rank_positions?select=subject_id,position.avg(),count()&subject_id=eq.$T1"
```

Esperado: agregado sobre zero linhas. Um `avg()` de posições invisíveis é a nota
alheia por outro nome. Se os agregados estiverem desactivados no PostgREST,
registar como mitigação de configuração — e verificar que a configuração está
versionada, senão volta atrás sozinha.

### A24 · A vista `scores`

Confirmar `security_invoker` directamente:

```sql
select c.relname, c.reloptions from pg_class c where c.relname = 'scores';
```

Esperado: `{security_invoker=on}`.

Falha: ausente ou `off` — a vista corre como dona e contorna toda a nota cega.
Este é o único ataque desta bateria que se faz por SQL e não por HTTP, porque o
que se está a testar é uma propriedade do objecto e não uma resposta.

Depois, atacar a vista por HTTP como se fosse tabela: `GET /scores?...` com
todos os vectores dos grupos 1 a 3.

### A25 · Tabelas sem RLS

```sql
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
```

Esperado: zero linhas. Uma tabela nova sem RLS é o modo de falha mais provável
de todo o projecto, porque acontece por omissão e não por erro.

### A26 · Realtime

Subscrever `postgres_changes` em `rank_positions`, `buckets` e `replies` com o
JWT do `fabio`, e provocar alterações como `ana`.

Esperado: `fabio` não recebe nada que não pudesse ler por `GET`.

Falha: qualquer evento. O Realtime tem controlo de autorização próprio; uma
tabela na publicação com RLS correcta pode na mesma emitir para quem não deve.

### A27 · RPC `security definer`

Para cada função da lista em `docs/esquema-fase-1.md` §7:

- `accept_follow_request` chamada por quem não é o `followee`.
- `add_to_circle` chamada com um `member` sem reciprocidade, e em paralelo para
  repetir o A13 por outro caminho.
- `handle_available` em ciclo, para enumerar handles existentes.

Esperado: as duas primeiras recusadas. A terceira **vai** funcionar — é o que a
função faz. Registar como **falha** se não tiver rate limiting, porque é um
oráculo de enumeração de contas e o produto tem perfis privados.

### A28 · JWT manipulado

- JWT expirado.
- JWT com `sub` de outro utilizador, assinado com o segredo errado.
- JWT com `role: service_role` no payload, assinatura inválida.
- Pedido só com `apikey` anónima e sem `Authorization`.

Esperado: `401` em todos. O último é o mais importante: confirma que o papel
`anon` não vê nada de nenhuma tabela de utilizador.

---

## Critério de veredicto

**Falha** — qualquer um destes bloqueia a fase:

- Uma linha de dados de utilizador chega a quem não a devia ver, por qualquer
  caminho, incluindo embeds, agregados, vistas e Realtime.
- Uma escrita em nome de outro `user_id` é aceite.
- O limite de 30 é ultrapassado, ainda que uma só vez em 20 tentativas.
- O Círculo aceita um membro sem reciprocidade.
- Um oráculo permite concluir com certeza que uma pessoa concreta avaliou um
  título concreto, sem se ter avaliado esse título.
- Uma tabela com dados de utilizador sem RLS activo.
- A vista `scores` sem `security_invoker = on`.
- Um `security definer` sem ADR.

**Aviso** — não bloqueia, fica registado no relatório e vai para o registo de
decisões em aberto:

- Diferenças de latência sem significado estatístico ao fim de 20 medições.
- Distinções observáveis que não permitem identificar pessoa **e** título ao
  mesmo tempo.
- Limites do modelo já conhecidos e assumidos, como o A5 (notas já lidas não se
  desleem).

**Regra final:** uma única falha bloqueia a Fase 1. Não há falhas menores nem
correcções adiadas para a fase seguinte — as regras 1 a 3 são a app, não uma
funcionalidade dela. O relatório termina com um veredicto explícito, `PASSA` ou
`BLOQUEIA`, e a lista do que não foi testado e porquê.
