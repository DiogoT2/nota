-- F0-4 · Grafo social, avaliações e o cenário de ataque
--
-- Este ficheiro constrói de propósito todas as situações-limite da bateria em
-- `docs/ataque-fase-1.md`. Corre como `postgres` e portanto ignora a RLS — é o
-- que se quer, porque o seed é a verdade contra a qual os ataques se medem.
--
-- Os pares que interessam:
--   ana ↔ carla   Círculo mútuo. Vêem notas de episódio uma da outra.
--   david → ana   segue (ana é pública). Não é Círculo: não vê episódios.
--   david → carla pedido pendente. Não vê nada da carla.
--   ana ⊘ eva     bloqueio. Invisibilidade nos dois sentidos.
--   bruno         privado e sem relação: as notas dele não se vêem, mesmo
--                 tendo eu avaliado o mesmo filme.
--   fabio         sem uma única avaliação: tem de ver zero notas de toda a
--                 gente, e é o atacante por omissão da bateria.

-- ── Seguir ───────────────────────────────────────────────────────────────────
-- O trigger `follows_estado_inicial` decide o estado a partir da privacidade do
-- alvo. Não se escreve `state` aqui: se o seed o fizesse, estaria a testar o
-- que ele próprio escreveu.

insert into public.follows (follower_id, followee_id) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'), -- ana → carla  (pending: carla é privada)
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'), -- carla → ana  (active: ana é pública)
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111'), -- david → ana  (active)
  ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333'), -- david → carla (pending)
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111'); -- bruno → ana  (active)

-- A carla aceita a ana. É a única transição de estado do seed, e é explícita.
update public.follows
   set state = 'active'
 where follower_id = '11111111-1111-1111-1111-111111111111'
   and followee_id = '33333333-3333-3333-3333-333333333333';

-- ── Círculo ──────────────────────────────────────────────────────────────────
-- Só possível agora, porque o trigger de reciprocidade exige `active` nos dois
-- sentidos. Se estas duas linhas passarem, a reciprocidade está a funcionar.

insert into public.circle_members (owner_id, member_id) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111');

-- ── Bloqueio ─────────────────────────────────────────────────────────────────
-- A eva segue a ana antes de ser bloqueada, para que o trigger de demolição
-- tenha alguma coisa para demolir. Se depois do bloqueio ainda houver um
-- `follows` entre as duas, o trigger não funcionou.

insert into public.follows (follower_id, followee_id) values
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111');

insert into public.blocks (blocker_id, blocked_id) values
  ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555');

-- ── Avaliações ───────────────────────────────────────────────────────────────
-- `buckets` é a prova de que se avaliou; `rank_positions` é a ordem. A nota sai
-- da vista `scores` e não está escrita em lado nenhum.
--
-- Filme 550 (Clube de Combate) é avaliado por ana, bruno, carla, david e eva —
-- é o título onde a nota cega se testa. O fabio não avalia nada.

insert into public.buckets (user_id, subject_type, subject_id, bucket) values
  -- ana
  ('11111111-1111-1111-1111-111111111111', 'movie', 'aaaa0001-0000-4000-8000-000000000001', 'adorei'),
  ('11111111-1111-1111-1111-111111111111', 'movie', 'aaaa0002-0000-4000-8000-000000000002', 'adorei'),
  ('11111111-1111-1111-1111-111111111111', 'movie', 'aaaa0003-0000-4000-8000-000000000003', 'gostei'),
  ('11111111-1111-1111-1111-111111111111', 'show',  'bbbb0001-0000-4000-8000-000000000001', 'adorei'),
  ('11111111-1111-1111-1111-111111111111', 'episode', 'dddd0001-0000-4000-8000-000000000001', 'adorei'),
  ('11111111-1111-1111-1111-111111111111', 'episode', 'dddd0002-0000-4000-8000-000000000002', 'gostei'),
  -- carla
  ('33333333-3333-3333-3333-333333333333', 'movie', 'aaaa0001-0000-4000-8000-000000000001', 'gostei'),
  ('33333333-3333-3333-3333-333333333333', 'movie', 'aaaa0002-0000-4000-8000-000000000002', 'adorei'),
  ('33333333-3333-3333-3333-333333333333', 'episode', 'dddd0001-0000-4000-8000-000000000001', 'adorei'),
  -- bruno (privado, sem relação com a ana)
  ('22222222-2222-2222-2222-222222222222', 'movie', 'aaaa0001-0000-4000-8000-000000000001', 'adorei'),
  ('22222222-2222-2222-2222-222222222222', 'movie', 'aaaa0003-0000-4000-8000-000000000003', 'nah'),
  -- david (segue a ana, não é do Círculo)
  ('44444444-4444-4444-4444-444444444444', 'movie', 'aaaa0001-0000-4000-8000-000000000001', 'nah'),
  ('44444444-4444-4444-4444-444444444444', 'episode', 'dddd0001-0000-4000-8000-000000000001', 'gostei'),
  -- eva (bloqueada pela ana)
  ('55555555-5555-5555-5555-555555555555', 'movie', 'aaaa0001-0000-4000-8000-000000000001', 'adorei');

-- Posições. Passo 1024, como manda a numeração esparsa. O âmbito de episódios
-- é o `titles.id` da série; tudo o resto usa o sentinela.
insert into public.rank_positions (user_id, subject_type, scope_id, subject_id, position) values
  ('11111111-1111-1111-1111-111111111111', 'movie', public.scope_global(), 'aaaa0001-0000-4000-8000-000000000001', 1024),
  ('11111111-1111-1111-1111-111111111111', 'movie', public.scope_global(), 'aaaa0002-0000-4000-8000-000000000002', 2048),
  ('11111111-1111-1111-1111-111111111111', 'movie', public.scope_global(), 'aaaa0003-0000-4000-8000-000000000003', 3072),
  ('11111111-1111-1111-1111-111111111111', 'show',  public.scope_global(), 'bbbb0001-0000-4000-8000-000000000001', 1024),
  ('11111111-1111-1111-1111-111111111111', 'episode', 'bbbb0001-0000-4000-8000-000000000001', 'dddd0001-0000-4000-8000-000000000001', 1024),
  ('11111111-1111-1111-1111-111111111111', 'episode', 'bbbb0001-0000-4000-8000-000000000001', 'dddd0002-0000-4000-8000-000000000002', 2048),
  ('33333333-3333-3333-3333-333333333333', 'movie', public.scope_global(), 'aaaa0002-0000-4000-8000-000000000002', 1024),
  ('33333333-3333-3333-3333-333333333333', 'movie', public.scope_global(), 'aaaa0001-0000-4000-8000-000000000001', 2048),
  ('33333333-3333-3333-3333-333333333333', 'episode', 'bbbb0001-0000-4000-8000-000000000001', 'dddd0001-0000-4000-8000-000000000001', 1024),
  ('22222222-2222-2222-2222-222222222222', 'movie', public.scope_global(), 'aaaa0001-0000-4000-8000-000000000001', 1024),
  ('22222222-2222-2222-2222-222222222222', 'movie', public.scope_global(), 'aaaa0003-0000-4000-8000-000000000003', 2048),
  ('44444444-4444-4444-4444-444444444444', 'movie', public.scope_global(), 'aaaa0001-0000-4000-8000-000000000001', 1024),
  ('44444444-4444-4444-4444-444444444444', 'episode', 'bbbb0001-0000-4000-8000-000000000001', 'dddd0001-0000-4000-8000-000000000001', 1024),
  ('55555555-5555-5555-5555-555555555555', 'movie', public.scope_global(), 'aaaa0001-0000-4000-8000-000000000001', 1024);

-- Episódios vistos. A ana e a carla viram o piloto; o david não. Sem esta
-- linha, nem estando no Círculo se vê a nota de episódio.
insert into public.watched (user_id, episode_id) values
  ('11111111-1111-1111-1111-111111111111', 'dddd0001-0000-4000-8000-000000000001'),
  ('11111111-1111-1111-1111-111111111111', 'dddd0002-0000-4000-8000-000000000002'),
  ('33333333-3333-3333-3333-333333333333', 'dddd0001-0000-4000-8000-000000000001');

-- ── Interacção ───────────────────────────────────────────────────────────────

insert into public.replies (user_id, target_user_id, target_subject_type, target_subject_id, body) values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'movie',
   'aaaa0001-0000-4000-8000-000000000001', 'Um 10 é demais. Mas percebo.');

insert into public.reactions (user_id, target_user_id, target_subject_type, target_subject_id, kind) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'movie',
   'aaaa0002-0000-4000-8000-000000000002', 'concordo');

-- ── taste_match ──────────────────────────────────────────────────────────────
-- Sobreposição acima do mínimo, para que o caminho de leitura seja testável. O
-- par é canónico: user_a < user_b.
insert into public.taste_match (user_a, user_b, overlap, affinity, computed_at) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 6, 0.812, now());
