-- F1-6 · Índices
--
-- Cada índice serve uma query nomeada. Os que o EXPLAIN não usar são apagados,
-- não guardados por precaução: um índice a mais custa em cada escrita e mente
-- sobre o desenho, sugerindo um acesso que ninguém faz.
--
-- Aviso sobre o EXPLAIN em F1-6: com tabelas pequenas o planeador escolhe
-- sequential scan por ser mais rápido, e isso não prova nada contra o índice.
-- A verificação faz-se com volume de seed ou com `set enable_seqscan = off`.
--
-- Nota sobre o feed (ADR 0002, decisão 3): o feed é só do Círculo. Não existe
-- índice de feed sobre `follows` — se um dia houver separador «A seguir», é
-- aqui que se acrescenta.

-- ── Perfis ───────────────────────────────────────────────────────────────────
-- `profiles (handle)` unique já existe pela constraint. Falta a pesquisa
-- parcial, que o `unique` não serve: `where handle ilike '%ana%'`.
create index profiles_handle_trgm
  on public.profiles using gin (handle gin_trgm_ops);

-- ── Grafo social ─────────────────────────────────────────────────────────────

-- Pedidos pendentes recebidos: `where followee_id = $1 and state = 'pending'`.
-- Também o ramo de `visible_profile` que verifica se sigo alguém.
create index follows_recebidos on public.follows (followee_id, state);

-- «Quem eu sigo»: `where follower_id = $1 and state = 'active'`. A PK é
-- (follower_id, followee_id) e serve o prefixo, mas não filtra por estado sem
-- ler as linhas.
create index follows_enviados on public.follows (follower_id, state);

-- `blocked()` pergunta nas duas direcções. A PK cobre uma; esta cobre a outra.
-- Dois índices porque o predicado é simétrico e é avaliado em quase todas as
-- políticas do esquema.
create index blocks_ao_contrario on public.blocks (blocked_id, blocker_id);

-- `circle_members (owner_id, member_id)` é a PK e serve `in_my_circle` e o
-- feed. Nenhum índice adicional.

-- Denúncias abertas, para a fila de moderação da Fase 4.
create index reports_abertas on public.reports (state, created_at)
  where state = 'open';

-- Expurgo de retenção: `where expires_at < now()`.
create index reports_expiram          on public.reports (expires_at);
create index moderation_audit_expiram on public.moderation_audit (expires_at);

-- ── Avaliação ────────────────────────────────────────────────────────────────

-- A nota cega. Este é o índice mais quente do esquema: o EXISTS «tenho balde
-- para este título?» é avaliado uma vez por linha candidata em toda a leitura
-- de notas alheias. Já existe como unique (user_id, subject_type, subject_id).

-- «Quem avaliou este título», para o ecrã de detalhe. Ordem diferente da do
-- unique, de propósito: aqui o título é conhecido e o utilizador não.
create index buckets_por_titulo
  on public.buckets (subject_type, subject_id, user_id);

-- O ranking pessoal de um âmbito, já ordenado. Existe como constraint única
-- diferida (user_id, subject_type, scope_id, position).

-- As notas de um título dadas por outras pessoas.
create index rank_positions_por_titulo
  on public.rank_positions (subject_type, subject_id);

-- O feed do Círculo: notas recentes de um conjunto de até 30 pessoas.
-- `where user_id = any($1) order by created_at desc limit $2`.
create index rank_positions_feed
  on public.rank_positions (user_id, created_at desc);

-- ── Interacção ───────────────────────────────────────────────────────────────

-- Respostas e reacções de uma nota, por ordem de chegada.
create index replies_por_nota
  on public.replies (target_user_id, target_subject_type, target_subject_id, created_at);

-- `reactions` tem unique (user_id, target_user_id, target_subject_type,
-- target_subject_id), que não serve para contar as reacções de uma nota.
create index reactions_por_nota
  on public.reactions (target_user_id, target_subject_type, target_subject_id);

-- ── taste_match ──────────────────────────────────────────────────────────────
-- A PK (user_a, user_b) serve o primeiro lado. O par é canónico, portanto ver o
-- meu taste match com alguém exige procurar nos dois papéis.
create index taste_match_lado_b on public.taste_match (user_b);
