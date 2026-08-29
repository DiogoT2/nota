-- Regras 2 e 3 · Visibilidade, Círculo, episódios e bloqueio

begin;
select plan(22);

create function pg_temp.autenticar(quem uuid) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', quem::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create function pg_temp.como_postgres() returns void
language plpgsql as $$
begin perform set_config('role', 'postgres', true); end;
$$;

-- ── Regra 2 · Perfis privados ────────────────────────────────────────────────

select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');  -- fabio, sem relações

select is_empty(
  $$ select 1 from public.profiles
      where handle in ('bruno', 'carla') $$,
  'um perfil privado não é legível por quem não o segue'
);

select isnt_empty(
  $$ select 1 from public.profiles where handle = 'ana' $$,
  'um perfil público é legível por qualquer pessoa com sessão'
);

-- A abertura deliberada: o cartão mínimo existe para se poder pedir para
-- seguir. Se não existisse, um perfil privado seria impossível de encontrar.
select isnt_empty(
  $$ select 1 from public.profile_cards where handle = 'carla' $$,
  'o cartão mínimo de um perfil privado é visível (para se poder pedir)'
);

select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'profile_cards'),
  5::bigint,
  'profile_cards expõe exactamente cinco colunas e nem mais uma'
);

-- ── Regra 2 · Seguir é unidireccional, e o estado não é escolhido ────────────

-- Lido como o próprio: a política de `follows` só mostra as linhas de quem lá
-- está. Perguntar isto como terceiro devolveria NULL — e um teste que confunde
-- «não existe» com «não vejo» não prova nada.
select pg_temp.autenticar('44444444-4444-4444-4444-444444444444');
select is(
  (select state::text from public.follows
    where follower_id = '44444444-4444-4444-4444-444444444444'
      and followee_id = '33333333-3333-3333-3333-333333333333'),
  'pending',
  'seguir um perfil privado gera pedido pendente'
);

select pg_temp.autenticar('22222222-2222-2222-2222-222222222222');
select is(
  (select state::text from public.follows
    where follower_id = '22222222-2222-2222-2222-222222222222'
      and followee_id = '11111111-1111-1111-1111-111111111111'),
  'active',
  'seguir um perfil público entra directamente em activo'
);

-- O cliente não escolhe o estado. Mesmo pedindo `active` sobre um privado.
select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');
insert into public.follows (follower_id, followee_id, state)
values ('66666666-6666-6666-6666-666666666666',
        '33333333-3333-3333-3333-333333333333', 'active');

select is(
  (select state::text from public.follows
    where follower_id = '66666666-6666-6666-6666-666666666666'
      and followee_id = '33333333-3333-3333-3333-333333333333'),
  'pending',
  'um cliente que envie state=active sobre um perfil privado é corrigido'
);

-- E um pedido pendente não dá acesso a nada.
select is_empty(
  $$ select 1 from public.profiles where handle = 'carla' $$,
  'um pedido pendente não abre o perfil'
);

-- ── Proibição permanente · não há como contar seguidores ─────────────────────

select is(
  (select count(*) from public.follows
    where followee_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'não se conta os seguidores de outra pessoa nem por agregação'
);

-- ── Regra 3 · Círculo ────────────────────────────────────────────────────────

select pg_temp.autenticar('11111111-1111-1111-1111-111111111111');  -- ana

select is(
  (select count(*) from public.circle_members),
  1::bigint,
  'o Círculo que se vê é o próprio, e mais nenhum'
);

select ok(
  public.in_my_circle('33333333-3333-3333-3333-333333333333'),
  'a carla está no Círculo da ana'
);

select ok(
  not public.in_my_circle('44444444-4444-4444-4444-444444444444'),
  'o david segue a ana mas não está no Círculo dela'
);

-- O contador é o limite de 30 materializado. Tem de acompanhar a realidade.
select is(
  (select circle_count from public.profiles where handle = 'ana'),
  1::smallint,
  'circle_count acompanha as inserções em circle_members'
);

-- ── Regra 3 · Notas de episódio ──────────────────────────────────────────────
--
-- Exigem Círculo E ter visto o episódio. E, por decisão do ADR 0002, exigem
-- Círculo mesmo quando o perfil é público — a ana é pública e o david avaliou
-- o mesmo episódio, e ainda assim não vê.

select isnt_empty(
  $$ select 1 from public.rank_positions
      where user_id = '33333333-3333-3333-3333-333333333333'
        and subject_type = 'episode' $$,
  'a ana vê a nota de episódio da carla: Círculo, balde próprio e episódio visto'
);

select pg_temp.autenticar('44444444-4444-4444-4444-444444444444');  -- david

select isnt_empty(
  $$ select 1 from public.rank_positions
      where user_id = '11111111-1111-1111-1111-111111111111'
        and subject_type = 'movie'
        and subject_id = 'aaaa0001-0000-4000-8000-000000000001' $$,
  'o david vê a nota de filme da ana (pública, e ele avaliou o mesmo filme)'
);

select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '11111111-1111-1111-1111-111111111111'
        and subject_type = 'episode' $$,
  'mas não vê nenhuma nota de episódio dela: episódios são só do Círculo'
);

-- Estar no Círculo não chega: é preciso ter visto o episódio.
select pg_temp.como_postgres();
delete from public.watched
 where user_id = '11111111-1111-1111-1111-111111111111'
   and episode_id = 'dddd0001-0000-4000-8000-000000000001';
select pg_temp.autenticar('11111111-1111-1111-1111-111111111111');

select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '33333333-3333-3333-3333-333333333333'
        and subject_type = 'episode'
        and subject_id = 'dddd0001-0000-4000-8000-000000000001' $$,
  'sem ter visto o episódio, nem o Círculo abre a nota de episódio'
);

-- ── Bloqueio ─────────────────────────────────────────────────────────────────

select pg_temp.autenticar('55555555-5555-5555-5555-555555555555');  -- eva, bloqueada pela ana

select is_empty(
  $$ select 1 from public.profiles where handle = 'ana' $$,
  'quem é bloqueado deixa de ver o perfil de quem bloqueou, mesmo sendo público'
);

select is_empty(
  $$ select 1 from public.profile_cards where handle = 'ana' $$,
  'o bloqueio também fecha o cartão mínimo — não há porta lateral'
);

select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'e fecha as notas, mesmo tendo a eva avaliado o mesmo filme'
);

select pg_temp.autenticar('11111111-1111-1111-1111-111111111111');  -- ana

select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '55555555-5555-5555-5555-555555555555' $$,
  'o bloqueio é simétrico: quem bloqueia também deixa de ver'
);

-- Bloquear demole a relação, não a esconde.
select is_empty(
  $$ select 1 from public.follows
      where (follower_id, followee_id) in (
        ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111'),
        ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555')
      ) $$,
  'bloquear apagou o follows que existia, nos dois sentidos'
);

select * from finish();
rollback;
