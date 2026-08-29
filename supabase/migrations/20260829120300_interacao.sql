-- F1-4 · Interacção
--
-- Reacções e respostas. As duas apontam para uma nota — que não é uma linha
-- própria, mas o par (autor, tipo, título) em `rank_positions`. É por isso que
-- o alvo é `(target_user_id, target_subject_type, target_subject_id)` e não um
-- `rating_id`: a nota não tem identidade própria, tem uma posição.
--
-- O limite de 140 caracteres é um CHECK. Um cliente que envie 141 recebe um
-- erro do Postgres, não uma validação que se pode desligar no DevTools.

create type public.reaction_kind as enum (
  'concordo', 'discordo', 'exagerado', 'injusto', 'obrigado'
);

create table public.reactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  target_user_id       uuid not null references public.profiles (id) on delete cascade,
  target_subject_type  public.subject_type not null,
  target_subject_id    uuid not null,
  kind                 public.reaction_kind not null,
  created_at           timestamptz not null default now(),
  unique (user_id, target_user_id, target_subject_type, target_subject_id),
  check (user_id <> target_user_id)
);

create table public.replies (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  target_user_id       uuid not null references public.profiles (id) on delete cascade,
  target_subject_type  public.subject_type not null,
  target_subject_id    uuid not null,
  -- `length()` conta caracteres, não bytes. Um «ã» ou um emoji contam um, como
  -- a pessoa que escreve espera. `octet_length()` daria limites diferentes
  -- consoante a língua, o que seria uma regra de produto acidental.
  body                 text not null check (char_length(body) between 1 and 140),
  created_at           timestamptz not null default now()
);

comment on column public.replies.body is
  'Máximo 140 caracteres, imposto por CHECK com char_length. Contar bytes penalizaria o português e os emoji.';

alter table public.reactions enable row level security;
alter table public.replies   enable row level security;
