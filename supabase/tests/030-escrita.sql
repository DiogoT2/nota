-- Escrita · ninguém escreve em nome de outro, e os limites são do motor
--
-- A leitura já foi atacada nos ficheiros anteriores. Aqui ataca-se a escrita,
-- que é o lado onde um cliente comprometido faz estragos permanentes em vez de
-- só ver o que não devia.

begin;
select plan(14);

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

select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');  -- fabio

-- ── Escrever em nome de outro ────────────────────────────────────────────────

select throws_ok(
  $$ insert into public.buckets (user_id, subject_type, subject_id, bucket)
     values ('11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0003-0000-4000-8000-000000000003', 'adorei') $$,
  '42501',
  null,
  'não se cria um balde em nome de outra pessoa'
);

select throws_ok(
  $$ insert into public.rank_positions
       (user_id, subject_type, subject_id, position)
     values ('11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0003-0000-4000-8000-000000000003', 4096) $$,
  '42501',
  null,
  'nem uma posição de ranking'
);

-- Escrever a própria e depois mudar o dono é a versão subtil do mesmo ataque.
-- Sem `with check`, o `using` deixaria passar: a linha antiga é minha.
insert into public.buckets (user_id, subject_type, subject_id, bucket)
values ('66666666-6666-6666-6666-666666666666', 'movie',
        'aaaa0003-0000-4000-8000-000000000003', 'nah');

select throws_ok(
  $$ update public.buckets
        set user_id = '11111111-1111-1111-1111-111111111111'
      where user_id = '66666666-6666-6666-6666-666666666666' $$,
  '42501',
  null,
  'nem se muda o dono de uma linha própria para outra pessoa'
);

-- ── O limite de 140 caracteres é do Postgres ─────────────────────────────────

select pg_temp.autenticar('33333333-3333-3333-3333-333333333333');  -- carla, do Círculo da ana

select lives_ok(
  $$ insert into public.replies
       (user_id, target_user_id, target_subject_type, target_subject_id, body)
     values ('33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0001-0000-4000-8000-000000000001', repeat('a', 140)) $$,
  '140 caracteres passam'
);

select throws_ok(
  $$ insert into public.replies
       (user_id, target_user_id, target_subject_type, target_subject_id, body)
     values ('33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0002-0000-4000-8000-000000000002', repeat('a', 141)) $$,
  '23514',
  null,
  '141 são recusados pelo CHECK, não pelo cliente'
);

-- Conta-se caracteres, não bytes. 140 acentos ocupam 280 bytes; se o limite
-- fosse `octet_length`, escrever em português custaria metade do espaço de
-- escrever em inglês — uma regra de produto acidental, nascida da codificação.
select lives_ok(
  $$ insert into public.replies
       (user_id, target_user_id, target_subject_type, target_subject_id, body)
     values ('33333333-3333-3333-3333-333333333333',
             '11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0001-0000-4000-8000-000000000001', repeat('ã', 140)) $$,
  '140 caracteres acentuados também passam: conta-se caracteres, não bytes'
);

-- ── Responder é exclusivo do Círculo (regra 3) ───────────────────────────────

select pg_temp.autenticar('44444444-4444-4444-4444-444444444444');  -- david, segue mas não é Círculo

select throws_ok(
  $$ insert into public.replies
       (user_id, target_user_id, target_subject_type, target_subject_id, body)
     values ('44444444-4444-4444-4444-444444444444',
             '11111111-1111-1111-1111-111111111111', 'movie',
             'aaaa0001-0000-4000-8000-000000000001', 'olá') $$,
  '42501',
  null,
  'quem não é do Círculo não responde a uma nota'
);

-- ── circle_count não se escreve ──────────────────────────────────────────────
--
-- Se se escrevesse, o limite de 30 contornava-se pondo o contador a zero e
-- continuando a inserir.

select pg_temp.autenticar('11111111-1111-1111-1111-111111111111');  -- ana

select throws_ok(
  $$ update public.profiles set circle_count = 0 where id = auth.uid() $$,
  null,
  null,
  'circle_count não é escrito por quem quer que seja, nem pelo próprio'
);

-- ── O limite de 30 ───────────────────────────────────────────────────────────
--
-- Aqui testa-se o CHECK. A prova de que resiste a DUAS transacções em
-- simultâneo não cabe num teste pgTAP, que corre numa sessão só: está em
-- `scripts/ataque-limite-circulo.mjs`, que abre duas ligações a sério.

select pg_temp.como_postgres();

-- 29 contas novas, todas em Círculo mútuo com a ana. Com a carla, dão 30.
do $$
declare
  i integer;
  novo uuid;
begin
  for i in 1..29 loop
    novo := ('9' || lpad(i::text, 7, '0') || '-0000-4000-8000-000000000000')::uuid;
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                            email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', novo, 'authenticated',
            'authenticated', 'enche' || i || '@nota.test', '', now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('handle', 'enche' || i), now(), now());
    insert into public.follows (follower_id, followee_id)
    values (novo, '11111111-1111-1111-1111-111111111111');
    insert into public.follows (follower_id, followee_id)
    values ('11111111-1111-1111-1111-111111111111', novo);
    -- A conta nova nasce privada, logo o follow da ana fica pendente. Aceitar
    -- é uma escrita explícita, tal como seria na app.
    update public.follows set state = 'active'
     where follower_id = '11111111-1111-1111-1111-111111111111'
       and followee_id = novo;
    insert into public.circle_members (owner_id, member_id)
    values ('11111111-1111-1111-1111-111111111111', novo);
  end loop;
end;
$$;

select is(
  (select circle_count from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  30::smallint,
  'o Círculo chega aos 30'
);

select throws_ok(
  $$ insert into public.circle_members (owner_id, member_id)
     values ('11111111-1111-1111-1111-111111111111',
             '22222222-2222-2222-2222-222222222222') $$,
  null,
  null,
  'o 31.º membro é recusado pelo motor'
);

-- Sair do Círculo devolve o lugar.
delete from public.circle_members
 where owner_id = '11111111-1111-1111-1111-111111111111'
   and member_id = '33333333-3333-3333-3333-333333333333';

select is(
  (select circle_count from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  29::smallint,
  'sair do Círculo decrementa o contador'
);

-- ── Reciprocidade ────────────────────────────────────────────────────────────

select throws_ok(
  $$ insert into public.circle_members (owner_id, member_id)
     values ('11111111-1111-1111-1111-111111111111',
             '66666666-6666-6666-6666-666666666666') $$,
  null,
  null,
  'não se põe no Círculo quem não nos segue de volta'
);

-- ── Renumeração ──────────────────────────────────────────────────────────────
--
-- O modo de falha dos inteiros esparsos é explícito: acaba o espaço, renumera-se.
-- Este teste força o caso — duas posições adjacentes — e verifica que a
-- renumeração corre sem violar a unicidade a meio da transacção. É a razão de
-- a constraint ser diferida.

insert into public.rank_positions (user_id, subject_type, subject_id, position)
values ('66666666-6666-6666-6666-666666666666', 'movie',
        'aaaa0001-0000-4000-8000-000000000001', 1),
       ('66666666-6666-6666-6666-666666666666', 'movie',
        'aaaa0002-0000-4000-8000-000000000002', 2);

select is(
  public.renumerar_ambito('66666666-6666-6666-6666-666666666666',
                          'movie', public.scope_global()),
  2,
  'a renumeração reescreve o âmbito inteiro'
);

select results_eq(
  $$ select position from public.rank_positions
      where user_id = '66666666-6666-6666-6666-666666666666'
      order by position $$,
  $$ values (1024::bigint), (2048::bigint) $$,
  'e devolve o passo de 1024, com espaço para inserir no meio outra vez'
);

select * from finish();
rollback;
