# Fase 1 — desenho do esquema e das políticas RLS

Documento de desenho. **Não contém migrações executáveis** — o SQL é escrito em
F1-1 a F1-5 depois de este documento ser revisto pelo `tech-lead`.

Invariantes que o esquema tem de tornar impossíveis de violar, não difíceis:

1. Nota cega — ninguém vê a nota de terceiros para um título sem ter dado a sua.
2. Perfil privado por omissão; seguir é unidireccional; privado gera pendente.
3. Círculo mútuo, máximo 30. Discordância, taste match, respostas e notas de
   episódio são exclusivos do Círculo.
4. A nota nunca é escrita. É derivada da posição num ranking.

Regras 1 a 3 vivem em RLS. Regra 4 vive na estrutura: não existe coluna de nota.

Convenções: todas as tabelas têm `created_at timestamptz not null default now()`.
`user_id` é sempre `uuid references auth.users(id) on delete cascade`, sujeito à
decisão em aberto sobre eliminação de conta (ver F1-1 em `docs/plano/fase-0-1.md`).

---

## 1. Tabelas

### 1.1 `profiles`

| coluna         | tipo                            | notas                                            |
| -------------- | ------------------------------- | ------------------------------------------------ |
| `id`           | `uuid` PK                       | = `auth.users.id`                                |
| `handle`       | `citext` unique not null        | `check (handle ~ '^[a-z0-9_]{3,20}$')`           |
| `display_name` | `text`                          |                                                  |
| `avatar_path`  | `text`                          | caminho no Storage, nunca URL                    |
| `is_private`   | `boolean not null default true` | **default `true`, regra 2**                      |
| `circle_count` | `smallint not null default 0`   | `check (circle_count between 0 and 30)` — ver §4 |
| `deleted_at`   | `timestamptz`                   | eliminação de conta                              |

Não existe `followers_count` nem coluna equivalente. Proibição permanente:
contagens públicas de seguidores.

### 1.2 `follows`

| coluna        | tipo                         | notas                                |
| ------------- | ---------------------------- | ------------------------------------ |
| `follower_id` | `uuid`                       |                                      |
| `followee_id` | `uuid`                       |                                      |
| `state`       | `follow_state not null`      | enum `pending \| active`             |
| PK            | `(follower_id, followee_id)` |                                      |
|               |                              | `check (follower_id <> followee_id)` |

Unidireccional. Segue de perfil público entra directamente em `active`; de perfil
privado entra em `pending` — imposto por trigger que lê `profiles.is_private`,
não pelo cliente, porque o cliente pode mentir no `state`.

### 1.3 `circle_members`

| coluna      | tipo                    | notas           |
| ----------- | ----------------------- | --------------- |
| `owner_id`  | `uuid`                  | dono do Círculo |
| `member_id` | `uuid`                  |                 |
| PK          | `(owner_id, member_id)` |                 |

Reciprocidade e limite de 30: ver §4. O Círculo é do dono; que B esteja no
Círculo de A não implica que A esteja no de B — mas exige `follows` activo nos
dois sentidos.

### 1.4 `blocks`

| coluna       | tipo                       | notas |
| ------------ | -------------------------- | ----- |
| `blocker_id` | `uuid`                     |       |
| `blocked_id` | `uuid`                     |       |
| PK           | `(blocker_id, blocked_id)` |       |

Efeito bidireccional: quem bloqueia e quem é bloqueado deixam de se ver. A
direcção existe na tabela apenas para saber quem pode desfazer.

Trigger ao inserir: apaga `follows` nos dois sentidos, `circle_members` nos dois
sentidos e `reactions`/`replies` cruzadas. O bloqueio não é um filtro de leitura
a acrescentar a tudo — é uma demolição da relação, e só depois um filtro.

### 1.5 `reports`

| coluna         | tipo                                   | notas                                       |
| -------------- | -------------------------------------- | ------------------------------------------- |
| `id`           | `uuid` PK                              |                                             |
| `reporter_id`  | `uuid`                                 |                                             |
| `subject_type` | `report_subject`                       | enum `profile \| reply \| rating`           |
| `subject_id`   | `uuid`                                 |                                             |
| `reason`       | `report_reason`                        | enum fechado, não texto livre               |
| `note`         | `text`                                 | `check (length(note) <= 500)`               |
| `state`        | `report_state not null default 'open'` | `open \| dismissed \| removed \| suspended` |

Retenção por decidir (ver decisões em aberto).

### 1.6 `titles`, `seasons`, `episodes` — cache TMDB

`titles`: `id uuid PK`, `tmdb_id int not null`, `kind title_kind` (`movie|tv`),
unique `(tmdb_id, kind)`, `title text`, `original_title text`, `year smallint`,
`poster_path text`, `overview text`, `lang text`, `status text` (para saber se
uma série está em emissão), `fetched_at timestamptz`, `ttl interval`.

Só `poster_path`. O URL é composto no cliente a partir de tamanhos permitidos —
proibição permanente.

`seasons`: `id uuid PK`, `title_id uuid`, `number smallint` (0 = especiais,
explicitamente permitido), unique `(title_id, number)`.

`episodes`: `id uuid PK`, `season_id uuid`, `number smallint`, `name text`,
`air_date date`, unique `(season_id, number)`.

Estas três tabelas são públicas para leitura a qualquer autenticado — são
metadados do TMDB, não dados de utilizador. Escrita: só `service_role`, a partir
das Edge Functions da Fase 2.

### 1.7 `buckets`

A prova de que o utilizador avaliou. É esta tabela que a nota cega interroga.

| coluna         | tipo                                  | notas                           |
| -------------- | ------------------------------------- | ------------------------------- |
| `id`           | `uuid` PK                             |                                 |
| `user_id`      | `uuid`                                |                                 |
| `subject_type` | `subject_type not null`               | enum `movie \| show \| episode` |
| `subject_id`   | `uuid`                                | `titles.id` ou `episodes.id`    |
| `bucket`       | `bucket not null`                     | enum `nah \| gostei \| adorei`  |
| unique         | `(user_id, subject_type, subject_id)` |                                 |

### 1.8 `rank_positions`

| coluna         | tipo                                                                          | notas                     |
| -------------- | ----------------------------------------------------------------------------- | ------------------------- |
| `id`           | `uuid` PK                                                                     |                           |
| `user_id`      | `uuid`                                                                        |                           |
| `subject_type` | `subject_type not null`                                                       |                           |
| `scope_id`     | `uuid`                                                                        | ver abaixo                |
| `subject_id`   | `uuid`                                                                        |                           |
| `position`     | `bigint not null`                                                             | numeração esparsa, ver §3 |
| unique         | `(user_id, subject_type, scope_id, subject_id)`                               | um título, uma posição    |
| unique         | `(user_id, subject_type, scope_id, position)` `deferrable initially deferred` | ver §3                    |

`scope_id` é o âmbito independente da regra do produto: `NULL` para filmes,
`NULL` para séries, e `titles.id` da série para episódios. Como Postgres trata
`NULL` como distinto em índices únicos, os âmbitos globais usam um UUID sentinela
fixo em vez de `NULL` — `'00000000-0000-0000-0000-000000000000'`. Um `NULL` num
índice único é uma porta aberta a duplicados.

**Não existe coluna de nota aqui nem em lado nenhum.** Regra 4.

### 1.9 `watched`

`user_id`, `episode_id`, PK `(user_id, episode_id)`, `watched_at timestamptz`.

Pré-condição das notas de episódio: ver a nota de episódio de outra pessoa exige
Círculo **e** ter visto esse episódio.

### 1.10 `reactions`

`id uuid PK`, `user_id`, `target_type` (`rating`), `target_id uuid`,
`kind reaction_kind` (enum fechado), unique `(user_id, target_type, target_id)`.

### 1.11 `replies`

`id uuid PK`, `user_id`, `target_type`, `target_id uuid`,
`body text not null check (length(body) between 1 and 140)`, `deleted_at`.

O 140 é `CHECK`. Um cliente que envie 141 recebe erro do Postgres.

### 1.12 `taste_match`

| coluna        | tipo                | notas                                                       |
| ------------- | ------------------- | ----------------------------------------------------------- |
| `user_a`      | `uuid`              | `check (user_a < user_b)` — par canónico, uma linha por par |
| `user_b`      | `uuid`              |                                                             |
| `overlap`     | `smallint not null` | títulos avaliados por ambos                                 |
| `score`       | `numeric(4,3)`      | `NULL` enquanto `overlap` < mínimo                          |
| `computed_at` | `timestamptz`       |                                                             |
| PK            | `(user_a, user_b)`  |                                                             |

Escrita só por `service_role`. O `check (user_a < user_b)` evita duas linhas por
par, que seriam duas superfícies de fuga em vez de uma.

---

## 2. Como a nota derivada é exposta

**Decisão: vista `scores` com `security_invoker = on`, não função.**

```
create view public.scores with (security_invoker = on) as
select p.user_id, p.subject_type, p.scope_id, p.subject_id,
       <derivação a partir de b.bucket e do rank de p.position dentro do balde>
from rank_positions p
join buckets b on ...
```

Razões:

- `security_invoker = on` faz a vista correr com as permissões e as políticas RLS
  de quem consulta. As políticas de `rank_positions` e `buckets` continuam a ser
  a única defesa; a vista não é uma segunda cópia da regra que pode divergir.
  Uma vista sem `security_invoker` correria como dona e **contornaria** a nota
  cega — é exactamente o erro que este projecto não pode cometer.
- Uma função `security definer` faria o mesmo trabalho mas obrigaria a
  reimplementar os predicados de visibilidade no corpo da função, duplicando a
  regra. Cada `security definer` é dívida que exige ADR (F1-7). Aqui não é
  preciso nenhum.
- É mais fácil de apagar: `drop view scores`. A derivação da nota vai mudar na
  Fase 3, quando o `ranking-engineer` fixar o algoritmo real; queremos que essa
  mudança seja uma linha de SQL e não uma migração de dados.

Intervalos, do PLAN.md: `nah` 0.0–4.9, `gostei` 5.0–7.9, `adorei` 8.0–10.0. A
derivação dentro de cada intervalo é interpolação sobre o rank **dentro do
balde**, arredondada a uma casa. O comportamento para baldes com menos de 5
títulos é decisão do `ranking-engineer` na Fase 3 — a vista fica com uma
implementação provisória marcada como tal.

Ponto de atenção para o `rls-adversary`: uma vista não tem políticas próprias.
Se alguma tabela base ficar sem RLS, a vista revela tudo. O teste de
`relrowsecurity` sobre `pg_class` (F1-5) é o que cobre isto.

---

## 3. Numeração em `rank_positions`

**Decisão: inteiros esparsos com passo 1024, e renumeração do âmbito inteiro
quando o intervalo entre vizinhos se esgota.**

Alternativa considerada: posição fraccionária (`numeric`), inserindo sempre no
ponto médio. Rejeitada — a precisão degrada-se de forma silenciosa ao fim de
~50 inserções sucessivas no mesmo intervalo, o modo de falha é um empate que
corrompe a ordem sem erro, e o produto tem uma reordenação manual arrastável
(Fase 5) que gera exactamente esse padrão de inserções repetidas no mesmo sítio.

Com inteiros esparsos o modo de falha é explícito: não há espaço, renumera-se.

- Inserir entre `a` e `b`: `position = (a + b) / 2`. Se `b - a <= 1`, renumera-se
  o âmbito.
- Renumeração: `update` de todas as linhas do âmbito para `1024, 2048, ...` numa
  única transacção. É barato porque um âmbito são dezenas a poucas centenas de
  linhas — é o ranking pessoal de uma pessoa, não uma tabela global.
- O índice único `(user_id, subject_type, scope_id, position)` é `deferrable
initially deferred` **precisamente** para a renumeração poder acontecer numa
  transacção sem passar por um estado intermédio inválido.

Custo assumido: a renumeração é `O(n)` no âmbito e trava esse âmbito. Aceitável
porque o âmbito é de um só utilizador e a operação é rara.

---

## 4. Reciprocidade e limite de 30 no Círculo

O ataque a resistir é: 30 e 31 inseridos em simultâneo. Um trigger que faça
`select count(*) from circle_members where owner_id = ...` **não** resiste — em
`read committed` as duas transacções contam 29, ambas passam, ambas commitam.
Isto é o ataque "ultrapassar o limite de 30 com duas escritas em simultâneo" do
PLAN.md, e é o mais fácil de falhar sem dar por isso.

**Decisão: contador materializado em `profiles.circle_count` com `CHECK`,
mantido por trigger.**

```
-- no trigger AFTER INSERT em circle_members
update profiles set circle_count = circle_count + 1 where id = NEW.owner_id;
```

Porque é que resiste: o `UPDATE` adquire um lock de linha em `profiles`. A
segunda transacção bloqueia até a primeira commitar, e só então lê o valor
actualizado, avalia o `CHECK (circle_count <= 30)` e falha. A serialização é
feita pelo motor no ponto exacto de contenção, sem depender do nível de
isolamento da sessão nem da disciplina de quem escreve o cliente.

`AFTER DELETE` decrementa. `circle_count` nunca é escrito directamente por
ninguém: a política de `UPDATE` em `profiles` exclui a coluna (`WITH CHECK`
comparando com o valor anterior), senão o limite contorna-se pondo o contador a
zero.

Reciprocidade, no mesmo trigger `BEFORE INSERT`:

```
exists (select 1 from follows where follower_id = NEW.owner_id
          and followee_id = NEW.member_id and state = 'active')
and
exists (select 1 from follows where follower_id = NEW.member_id
          and followee_id = NEW.owner_id and state = 'active')
and not exists (select 1 from blocks where (blocker_id, blocked_id)
          in ((NEW.owner_id, NEW.member_id), (NEW.member_id, NEW.owner_id)))
```

Um trigger e não só uma política porque a reciprocidade depende de duas linhas
de outra tabela e queremos a mensagem de erro do domínio, não um `403` opaco.

Alternativa considerada: `pg_advisory_xact_lock(hashtextextended(owner_id))` no
início do trigger. Funciona igualmente, mas o lock é invisível no esquema e
esquece-se; o `CHECK` numa coluna é auto-documentado e o CI pode verificá-lo.

---

## 5. Esboço das políticas RLS

RLS activo em: `profiles`, `follows`, `circle_members`, `blocks`, `reports`,
`buckets`, `rank_positions`, `watched`, `reactions`, `replies`, `taste_match`.
`titles`, `seasons`, `episodes` são metadados públicos: RLS activo na mesma,
com `SELECT` a qualquer autenticado e escrita só a `service_role`.

Três predicados auxiliares, funções `stable` e `security invoker` (não
`definer` — não precisam):

- `blocked(other uuid)` — existe bloqueio em qualquer direcção entre
  `auth.uid()` e `other`.
- `visible_profile(other uuid)` — `other = auth.uid()`, ou o perfil é público, ou
  existe `follows(auth.uid() -> other)` em `active`. **E** `not blocked(other)`.
- `in_my_circle(other uuid)` — `circle_members(owner_id = auth.uid(), member_id
= other)` **e** `not blocked(other)`.

Que `blocked()` esteja dentro de `visible_profile()` e de `in_my_circle()` é
deliberado: o bloqueio não pode ser uma cláusula que alguém se esquece de
acrescentar numa política nova.

### Por tabela

**`profiles`** · SELECT: `visible_profile(id)`. Excepção: o cartão mínimo
(`handle`, `display_name`, `avatar_path`, `is_private`) de um perfil privado tem
de ser visível para se poder pedir para seguir — expõe-se por uma vista
`profile_cards` separada com essas colunas e mais nenhuma, não abrindo a tabela.
INSERT/UPDATE: `id = auth.uid()`, com `WITH CHECK` a impedir escrita em
`circle_count`. DELETE: nunca directo.

**`follows`** · SELECT: `follower_id = auth.uid() or followee_id = auth.uid()`.
Ninguém vê o grafo de terceiros — é isto que impede reconstruir contagens de
seguidores por agregação. INSERT: `follower_id = auth.uid()`, `not blocked(followee_id)`,
`state` forçado por trigger. UPDATE (aceitar/recusar pedido): só o `followee_id`,
e só `pending -> active`. DELETE: qualquer um dos dois lados.

**`circle_members`** · SELECT: `owner_id = auth.uid()`. O Círculo de terceiros
não é visível. INSERT/DELETE: `owner_id = auth.uid()`, com o trigger de §4.

**`blocks`** · SELECT/INSERT/DELETE: `blocker_id = auth.uid()`. Quem é bloqueado
não sabe que o é — não há política que lho revele.

**`reports`** · SELECT: `reporter_id = auth.uid()` (o estado da denúncia é
visível a quem denuncia, requisito da Fase 4). INSERT: `reporter_id = auth.uid()`.
UPDATE: só moderação, via `service_role`.

**`buckets`** · SELECT: `user_id = auth.uid()`, **ou** (`visible_profile(user_id)`
e eu tenho bucket próprio para o mesmo `(subject_type, subject_id)`). Este
segundo ramo é a nota cega. INSERT/UPDATE/DELETE: `user_id = auth.uid()`.

**`rank_positions`** · SELECT: `user_id = auth.uid()`, **ou**:

```
visible_profile(user_id)
and exists (select 1 from buckets mine
            where mine.user_id = auth.uid()
              and mine.subject_type = rank_positions.subject_type
              and mine.subject_id  = rank_positions.subject_id)
and (rank_positions.subject_type <> 'episode' or (
        in_my_circle(rank_positions.user_id)
    and exists (select 1 from watched w
                where w.user_id = auth.uid()
                  and w.episode_id = rank_positions.subject_id)))
```

Três condições numa política só, e não três políticas — políticas `PERMISSIVE`
somam-se com `OR`, o que aqui seria um buraco. Se forem escritas em separado,
têm de ser `RESTRICTIVE`.

**`watched`** · SELECT: próprio, ou `in_my_circle(user_id)`.
INSERT/DELETE: próprio.

**`reactions` e `replies`** · SELECT: só se eu puder ver a nota alvo — a
política referencia `rank_positions` e herda a nota cega por composição, em vez
de repetir o predicado. INSERT: `user_id = auth.uid()`, mais `in_my_circle` do
autor da nota (respostas são exclusivas do Círculo, regra 3), mais `not blocked`.
UPDATE/DELETE: só o autor.

**`taste_match`** · SELECT: `auth.uid() in (user_a, user_b)` **e**
`in_my_circle(o outro)` **e** `overlap >= mínimo` (senão o `score` é `NULL` e
não há o que revelar). Escrita: só `service_role`.

---

## 6. Índices

| índice                                                                | serve                                                                         |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `profiles (handle)` unique, `citext`                                  | pesquisa de handle: `where handle = $1`                                       |
| `profiles using gin (handle gin_trgm_ops)`                            | pesquisa parcial de handle, se o produto a exigir                             |
| `follows (followee_id, state)`                                        | pedidos pendentes; predicado de `visible_profile`                             |
| `follows (follower_id, state)`                                        | "quem sigo", usado em todos os predicados                                     |
| `circle_members (owner_id)`                                           | `in_my_circle`, avaliado em quase todas as políticas                          |
| `blocks (blocker_id, blocked_id)` e `blocks (blocked_id, blocker_id)` | `blocked()` nas duas direcções — dois índices, porque o predicado é simétrico |
| `buckets (user_id, subject_type, subject_id)` unique                  | nota cega: o `EXISTS` do meu bucket                                           |
| `buckets (subject_type, subject_id, user_id)`                         | quem avaliou este título, para o detalhe                                      |
| `rank_positions (user_id, subject_type, scope_id, position)`          | ranking pessoal por âmbito, já ordenado                                       |
| `rank_positions (subject_type, subject_id)`                           | notas de um título dadas por outros                                           |
| `rank_positions (user_id, created_at desc)`                           | feed cronológico do Círculo                                                   |
| `watched (user_id, episode_id)` PK                                    | pré-condição das notas de episódio                                            |
| `replies (target_type, target_id, created_at)`                        | respostas de uma nota                                                         |
| `taste_match (user_a)`, `(user_b)`                                    | perfil                                                                        |

Cada um destes tem de aparecer num `EXPLAIN` real em F1-6. Os que não
aparecerem são apagados.

O índice de feed depende da decisão em aberto "Círculo, ou duas tabs" — se
existir uma tab "A seguir", o feed passa a percorrer `follows` e não
`circle_members`, e o índice muda.

---

## 7. Funções `security definer` previstas

Cada uma exige ADR próprio (F1-7). A lista é deliberadamente curta.

1. `accept_follow_request(follower uuid)` — precisa de escrever numa linha de
   `follows` cujo `follower_id` não é o chamador. Justificação: transição de
   estado que só o `followee` pode fazer, expressa como operação e não como
   `UPDATE` livre.
2. `add_to_circle(member uuid)` — encapsula a verificação de reciprocidade, o
   incremento do contador e a mensagem de erro do domínio numa transacção.
3. `handle_available(h citext)` — responde sim/não sem revelar o perfil. Sem
   ela, o registo obrigaria a abrir `SELECT` em `profiles.handle` a toda a gente.
   **Risco: é um oráculo de enumeração de handles.** Precisa de rate limiting.

Nenhuma função `security definer` para leitura de notas. Se aparecer uma
proposta dessas, é sinal de que a política está errada.

---

## 8. Riscos e vectores que este desenho deixa em aberto

Para o `rls-adversary` atacar. Escrito por quem desenhou, o que significa que
está incompleto por construção.

1. **`count=exact` sobre `rank_positions`.** A política filtra linhas, mas um
   `HEAD` com `Prefer: count=exact` devolve a contagem das linhas visíveis.
   Se a contagem for calculada antes do filtro em algum caminho, revela quantas
   pessoas avaliaram um título sem eu ter avaliado.
2. **Embeds do PostgREST.** `GET /profiles?select=*,rank_positions(*)` avalia RLS
   em cada tabela, mas a forma do resultado (perfil presente com array vazio vs
   perfil ausente) distingue "não avaliou" de "não posso ver".
3. **Ordenação por coluna não visível.** `?order=position.desc` sobre linhas
   filtradas pode ordenar por um valor que não devia ser observável, e a ordem
   do resultado é informação.
4. **A vista `scores`.** Sem `security_invoker` correria como dona e revelaria
   tudo. Verificar em pgTAP que a opção está mesmo `on` — não confiar no ficheiro.
5. **`profile_cards`.** A vista de cartão mínimo é uma abertura deliberada em
   perfis privados. Confirmar que não expõe mais nenhuma coluna e que respeita
   `blocked()`.
6. **`handle_available`.** Oráculo de enumeração. É `security definer` e não tem
   rate limiting no desenho.
7. **`circle_count`.** Se a política de `UPDATE` em `profiles` não excluir a
   coluna, o limite de 30 contorna-se com um `PATCH`.
8. **Políticas `PERMISSIVE` somadas.** Se a nota cega for escrita como três
   políticas separadas em vez de uma, o `OR` implícito abre tudo.
9. **Apagar o bucket depois de ler.** Avaliar, ler as notas alheias, apagar a
   avaliação. As notas já foram lidas. O esquema não impede — se o produto quiser
   impedir, precisa de retenção ou de custo em apagar, e isso é decisão de
   produto, não de RLS.
10. **Realtime.** As subscrições do Supabase Realtime têm de respeitar RLS, mas
    é configuração separada. Uma tabela na publicação com RLS mal aplicada
    transmite as alterações a quem estiver a ouvir.
11. **Mensagens de erro distintas.** `404` para inexistente e `403` para sem
    acesso é um oráculo. Ambos devem ser indistinguíveis.
12. **`upsert` com `on_conflict`.** Um `POST` com `Prefer: resolution=merge-duplicates`
    revela a existência de uma linha em conflito mesmo que ela não seja legível.
