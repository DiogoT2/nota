-- F1-5 · Testes de estrutura
--
-- Estes testes não atacam nada. Verificam propriedades do esquema que, se
-- deixarem de valer, tornam todos os outros testes inúteis — e fazem-no
-- interrogando o catálogo do Postgres, não lendo os ficheiros de migração. Um
-- teste que lê o SQL que escrevemos testa a nossa intenção; este testa a base.

begin;
select plan(11);

-- ── RLS em toda a parte ──────────────────────────────────────────────────────
--
-- O teste mais importante do ficheiro. Percorre `pg_class` e falha se alguma
-- tabela de `public` não tiver `relrowsecurity`. É escrito como uma varredura
-- e não como uma lista de nomes de propósito: uma lista tem de ser actualizada
-- à mão sempre que nasce uma tabela, e a tabela que alguém se esquecer de
-- acrescentar é exactamente a que vai ficar sem RLS.

select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and not c.relrowsecurity $$,
  'toda a tabela de public tem row level security activo'
);

-- RLS activo sem políticas nenhumas é fechado, o que é seguro mas provavelmente
-- não intencional. A excepção é `moderation_audit`, invisível de propósito.
select is_empty(
  $$ select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relrowsecurity
        and c.relname <> 'moderation_audit'
        and not exists (select 1 from pg_policy p where p.polrelid = c.oid) $$,
  'nenhuma tabela com RLS activo ficou sem políticas por engano'
);

-- ── A vista da nota ──────────────────────────────────────────────────────────
--
-- Verificado no catálogo, não no ficheiro. Se esta opção cair, a vista passa a
-- correr como dona e devolve as notas de toda a gente a toda a gente — a fuga
-- exacta que o produto inteiro existe para evitar.

select ok(
  (select 'security_invoker=on' = any (c.reloptions)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'scores'),
  'a vista scores tem security_invoker = on'
);

-- ── Regra 4: a nota não é uma coluna ─────────────────────────────────────────
--
-- Se aparecer uma coluna de nota numa tabela, a regra 4 morreu nesse commit.
-- `scores.score` é a vista, e é a única excepção.

select is_empty(
  $$ select c.relname || '.' || a.attname
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and a.attnum > 0
        and not a.attisdropped
        and a.attname in ('score', 'rating', 'nota', 'stars', 'grade') $$,
  'nenhuma tabela tem coluna de nota — a nota é derivada (regra 4)'
);

-- ── Regra 2: privado por omissão ─────────────────────────────────────────────

select col_default_is(
  'public', 'profiles', 'is_private', 'true',
  'profiles.is_private tem default true (regra 2)'
);

-- E na prática, não só no catálogo: uma conta nova nasce privada.
select is(
  (select is_private from public.profiles where handle = 'fabio'),
  true,
  'uma conta criada sem tocar em is_private fica privada'
);

-- ── Proibição permanente: contagens de seguidores ────────────────────────────

select is_empty(
  $$ select c.relname || '.' || a.attname
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'v')
        and a.attnum > 0
        and not a.attisdropped
        and (a.attname like '%follower%count%' or a.attname like '%followers%') $$,
  'não existe coluna de contagem de seguidores em lado nenhum'
);

-- ── O índice diferido da renumeração ─────────────────────────────────────────
--
-- Se esta constraint deixar de ser diferível, `renumerar_ambito` passa a falhar
-- a meio da transacção — e falha só quando um ranking real ficar sem espaço,
-- provavelmente em produção.

select ok(
  (select con.condeferrable and con.condeferred
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
    where c.relname = 'rank_positions'
      and con.conname = 'rank_positions_posicao_unica'),
  'a unicidade da posição é deferrable initially deferred'
);

-- ── Os predicados auxiliares ─────────────────────────────────────────────────

select ok(
  (select bool_and(p.prosecdef)
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('blocked', 'visible_profile', 'in_my_circle')),
  'os três predicados são security definer (senão o bloqueio deixa de ser simétrico)'
);

-- Uma função `security definer` sem `search_path` fixo é sequestrável por quem
-- consiga criar um esquema — o vector clássico de escalada de privilégios.
select is_empty(
  $$ select p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.prosecdef
        and (p.proconfig is null
             or not exists (select 1 from unnest(p.proconfig) cfg
                             where cfg like 'search_path=%')) $$,
  'toda a função security definer tem search_path fixo'
);

-- ── O limite de 30 está no esquema, não só num trigger ───────────────────────

select ok(
  (select count(*) > 0
     from pg_constraint con
     join pg_class c on c.oid = con.conrelid
    where c.relname = 'profiles'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) like '%circle_count%30%'),
  'o limite de 30 é um CHECK em profiles.circle_count'
);

select * from finish();
rollback;
