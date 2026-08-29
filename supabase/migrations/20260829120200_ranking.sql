-- F1-3 · Ranking e nota derivada
--
-- Regra 4 do produto: a nota nunca é escrita pelo utilizador. Aqui isso não é
-- uma convenção — **não existe uma coluna de nota em tabela nenhuma**. O que
-- existe é uma posição num ranking e um balde; a nota é uma vista por cima
-- disso. Um cliente comprometido não tem onde escrever um 10.
--
-- Se algum dia aparecer uma coluna de nota numa tabela, a regra 4 morreu nesse
-- commit, e o teste de F1-3 existe para o apanhar.

create type public.bucket as enum ('nah', 'gostei', 'adorei');

-- ── buckets ──────────────────────────────────────────────────────────────────
-- A prova de que a pessoa avaliou. É esta tabela que a nota cega interroga:
-- «tens balde para este título?». Sem linha aqui, não se vê nada de ninguém.

create table public.buckets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  subject_type  public.subject_type not null,
  subject_id    uuid not null,
  bucket        public.bucket not null,
  created_at    timestamptz not null default now(),
  unique (user_id, subject_type, subject_id)
);

-- ── rank_positions ───────────────────────────────────────────────────────────

-- Âmbitos globais (filmes, séries) usam este UUID em vez de NULL: o Postgres
-- trata NULL como distinto num índice único, portanto um scope_id nulo
-- permitiria duplicados silenciosos exactamente onde a unicidade importa.
create function public.scope_global() returns uuid
language sql immutable parallel safe
as $fn$ select '00000000-0000-0000-0000-000000000000'::uuid $fn$;

create table public.rank_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  subject_type  public.subject_type not null,
  -- Filmes e séries: o sentinela. Episódios: o `titles.id` da série, porque o
  -- ranking de episódios é por série e não global.
  scope_id      uuid not null default public.scope_global(),
  subject_id    uuid not null,
  -- Numeração esparsa, passo 1024. Ver `renumerar_ambito` abaixo.
  position      bigint not null check (position > 0),
  created_at    timestamptz not null default now(),
  unique (user_id, subject_type, scope_id, subject_id),
  -- Episódios têm âmbito próprio; tudo o resto vive no âmbito global.
  check (
    (subject_type = 'episode' and scope_id <> public.scope_global())
    or (subject_type <> 'episode' and scope_id = public.scope_global())
  )
);

-- Unicidade da posição dentro do âmbito, mas DIFERIDA. A renumeração reescreve
-- todas as linhas do âmbito numa transacção e passa necessariamente por
-- estados intermédios em que duas linhas partilham a mesma posição. Com um
-- índice imediato, a renumeração seria impossível sem uma tabela temporária.
create unique index rank_positions_posicao_unica
  on public.rank_positions (user_id, subject_type, scope_id, position);
alter table public.rank_positions
  add constraint rank_positions_posicao_unica
  unique using index rank_positions_posicao_unica
  deferrable initially deferred;

comment on column public.rank_positions.position is
  'Inteiro esparso, passo 1024. Inserir entre a e b usa (a+b)/2; quando b-a <= 1 renumera-se o âmbito. Posição fraccionária foi rejeitada: a precisão do numeric degrada-se em silêncio ao fim de ~50 inserções no mesmo intervalo, e o modo de falha é um empate que corrompe a ordem sem dar erro.';

-- Renumeração do âmbito. O modo de falha dos inteiros esparsos é explícito:
-- acabou o espaço, renumera-se. É O(n) e trava o âmbito, o que é aceitável
-- porque um âmbito é o ranking pessoal de uma pessoa — dezenas a poucas
-- centenas de linhas — e a operação é rara.
create function public.renumerar_ambito(
  p_user uuid,
  p_subject_type public.subject_type,
  p_scope uuid
) returns integer
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  n integer;
begin
  -- Travar as linhas do âmbito antes de as reordenar. Em instrução separada
  -- porque o Postgres recusa `for update` numa consulta com funções de janela,
  -- e o `row_number()` é o que produz a nova ordem.
  perform 1 from public.rank_positions
   where user_id = p_user
     and subject_type = p_subject_type
     and scope_id = p_scope
   for update;

  with ordenado as (
    select id, row_number() over (order by position) as ordem
      from public.rank_positions
     where user_id = p_user
       and subject_type = p_subject_type
       and scope_id = p_scope
  )
  update public.rank_positions r
     set position = o.ordem * 1024
    from ordenado o
   where r.id = o.id;
  get diagnostics n = row_count;
  return n;
end;
$fn$;

-- ── taste_match ──────────────────────────────────────────────────────────────

create table public.taste_match (
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  -- Títulos avaliados por ambos.
  overlap      smallint not null default 0,
  -- Afinidade 0–1. Chama-se `affinity` e não `score` de propósito: neste
  -- esquema a palavra «score» pertence à nota derivada e a mais nada, para que
  -- o teste que procura colunas de nota não tenha falsos positivos nem, pior,
  -- se habitue a ignorá-los.
  affinity     numeric(4, 3) check (affinity is null or affinity between 0 and 1),
  computed_at  timestamptz,
  primary key (user_a, user_b),
  -- Par canónico: uma linha por par, não duas. Duas linhas seriam duas
  -- superfícies de fuga a manter em sincronia.
  check (user_a < user_b)
);

-- ── A nota derivada ──────────────────────────────────────────────────────────
--
-- `security_invoker = on` é o ponto inteiro desta vista. Com ele, a vista corre
-- com as políticas RLS de quem consulta, e as políticas de `rank_positions` e
-- `buckets` continuam a ser a única defesa. Sem ele, a vista correria com os
-- privilégios do dono e **contornaria a nota cega** — a vista tornar-se-ia o
-- buraco que todo o resto do esquema existe para fechar.
--
-- Uma função `security definer` faria o mesmo trabalho, mas obrigaria a
-- reimplementar os predicados de visibilidade no corpo, duplicando a regra em
-- dois sítios que hão-de divergir.
--
-- PROVISÓRIO: os intervalos são os do PLAN.md, a interpolação é linear sobre o
-- rank dentro do balde. O algoritmo real é da Fase 3, do `ranking-engineer`.
-- Está numa vista precisamente para que essa mudança seja `create or replace
-- view` e não uma migração de dados.

create view public.scores
with (security_invoker = on) as
with rankeado as (
  select
    r.user_id,
    r.subject_type,
    r.scope_id,
    r.subject_id,
    r.position,
    r.created_at,
    b.bucket,
    row_number() over (
      partition by r.user_id, r.subject_type, r.scope_id, b.bucket
      order by r.position
    ) as lugar,
    count(*) over (
      partition by r.user_id, r.subject_type, r.scope_id, b.bucket
    ) as no_balde
  from public.rank_positions r
  join public.buckets b
    on b.user_id = r.user_id
   and b.subject_type = r.subject_type
   and b.subject_id = r.subject_id
)
select
  user_id,
  subject_type,
  scope_id,
  subject_id,
  bucket,
  position,
  created_at,
  round(
    case
      -- Um só título no balde não tem ordem relativa nenhuma: fica no meio do
      -- intervalo. Pôr no topo diria que é o melhor de uma lista de um.
      when no_balde = 1 then (topo + base) / 2
      else topo - (lugar - 1) * (topo - base) / (no_balde - 1)
    end,
    1
  )::numeric(3, 1) as score
from rankeado,
lateral (
  select
    case bucket when 'adorei' then 10.0 when 'gostei' then 7.9 else 4.9 end,
    case bucket when 'adorei' then 8.0  when 'gostei' then 5.0 else 0.0 end
) as intervalo (topo, base);

comment on view public.scores is
  'A nota. Derivada, nunca escrita. security_invoker = on: a vista herda as políticas de quem consulta, e não as do dono. Verificado em pgTAP contra pg_class.reloptions, não por leitura do ficheiro.';

alter table public.buckets        enable row level security;
alter table public.rank_positions enable row level security;
alter table public.taste_match    enable row level security;
