-- Regra 1 · Nota cega
--
-- Ninguém vê a nota de terceiros para um título sem ter dado a sua. Aqui
-- ataca-se de dentro da base, com o papel `authenticated` e um JWT forjado —
-- que é o mais perto que se chega de um cliente comprometido sem sair do
-- Postgres. A bateria de fora, contra o PostgREST, é a de
-- `docs/ataque-fase-1.md` e corre por cima desta.
--
-- Convenção: `autenticar()` põe o papel e as claims. Sem `set local role
-- authenticated` os testes correriam como `postgres`, que ignora RLS por
-- completo — e passariam todos sem provar nada.

begin;
select plan(12);

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
begin
  perform set_config('role', 'postgres', true);
end;
$$;

-- ana    11111111  pública, avaliou o filme 550
-- bruno  22222222  privado, avaliou o filme 550
-- carla  33333333  privada, Círculo da ana, avaliou o 550
-- david  44444444  segue a ana, avaliou o 550
-- eva    55555555  bloqueada pela ana, avaliou o 550
-- fabio  66666666  não avaliou nada

-- ── O atacante sem avaliação nenhuma ─────────────────────────────────────────

select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');

select is(
  (select count(*) from public.rank_positions),
  0::bigint,
  'quem não avaliou nada não vê uma única posição de ranking'
);

select is(
  (select count(*) from public.scores),
  0::bigint,
  'e também não vê uma única nota pela vista'
);

select is(
  (select count(*) from public.buckets),
  0::bigint,
  'nem sequer vê que alguém avaliou'
);

-- O ataque do `count=exact`: a contagem tem de ser contagem das linhas
-- visíveis, não do total filtrado depois.
select is(
  (select count(*) from public.rank_positions
    where subject_id = 'aaaa0001-0000-4000-8000-000000000001'),
  0::bigint,
  'contar notas de um título não revela quantas pessoas o avaliaram'
);

-- ── Avaliar abre a porta, e só essa porta ────────────────────────────────────

select pg_temp.como_postgres();
insert into public.buckets (user_id, subject_type, subject_id, bucket)
values ('66666666-6666-6666-6666-666666666666', 'movie',
        'aaaa0001-0000-4000-8000-000000000001', 'gostei');
select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');

-- A ana é pública: avaliei o mesmo filme, logo vejo a nota dela.
select isnt_empty(
  $$ select 1 from public.rank_positions
      where user_id = '11111111-1111-1111-1111-111111111111'
        and subject_id = 'aaaa0001-0000-4000-8000-000000000001' $$,
  'depois de avaliar, vejo a nota de um perfil público para esse título'
);

-- Mas só para ESSE título. O outro filme da ana continua fechado.
select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '11111111-1111-1111-1111-111111111111'
        and subject_id = 'aaaa0002-0000-4000-8000-000000000002' $$,
  'avaliar um título não abre os outros títulos da mesma pessoa'
);

-- E não abre perfis privados: o bruno avaliou o mesmo filme, mas é privado e
-- não me aceitou. Regra 1 satisfeita, regra 2 não.
select is_empty(
  $$ select 1 from public.rank_positions
      where user_id = '22222222-2222-2222-2222-222222222222'
        and subject_id = 'aaaa0001-0000-4000-8000-000000000001' $$,
  'a nota cega não é suficiente: um perfil privado continua fechado'
);

-- ── Apagar o balde fecha a porta outra vez ───────────────────────────────────
-- Não desfaz o que já foi lido — isso é impossível e está assumido no desenho —
-- mas a partir daqui deixa de ver.

select pg_temp.como_postgres();
delete from public.buckets
 where user_id = '66666666-6666-6666-6666-666666666666';
select pg_temp.autenticar('66666666-6666-6666-6666-666666666666');

select is(
  (select count(*) from public.rank_positions),
  0::bigint,
  'apagar a própria avaliação fecha outra vez o acesso às alheias'
);

-- ── A nota derivada não escapa pela vista ────────────────────────────────────
--
-- A vista `scores` não tem políticas próprias. Se herdar mal, é aqui que se vê.

select pg_temp.autenticar('44444444-4444-4444-4444-444444444444');

select isnt_empty(
  $$ select 1 from public.scores
      where user_id = '11111111-1111-1111-1111-111111111111'
        and subject_id = 'aaaa0001-0000-4000-8000-000000000001' $$,
  'o david avaliou o 550 e segue a ana, logo vê a nota dela para o 550'
);

select is_empty(
  $$ select 1 from public.scores
      where user_id = '33333333-3333-3333-3333-333333333333' $$,
  'mas não vê nada da carla, que é privada e não o aceitou'
);

-- ── A nota derivada está dentro do intervalo do balde ────────────────────────

select pg_temp.autenticar('11111111-1111-1111-1111-111111111111');

select is_empty(
  $$ select subject_id, bucket, score from public.scores
      where score is null
         or (bucket = 'adorei' and score not between 8.0 and 10.0)
         or (bucket = 'gostei' and score not between 5.0 and 7.9)
         or (bucket = 'nah'    and score not between 0.0 and 4.9) $$,
  'toda a nota derivada cai dentro do intervalo do seu balde'
);

-- Regra 4, verificada pelo comportamento e não pelo catálogo: não há por onde
-- escrever uma nota. A vista não é actualizável.
select throws_ok(
  $$ update public.scores set score = 10.0
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  null,
  'a nota não se escreve: a vista scores não aceita UPDATE'
);

select * from finish();
rollback;
