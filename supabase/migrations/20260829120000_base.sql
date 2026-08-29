-- F1-1 · Migração base
--
-- Tabelas sem dependência do grafo social: perfis, metadados do TMDB e o
-- registo de episódios vistos.
--
-- Decisões que esta migração materializa:
--   · `is_private` tem default `true` (regra 2 do produto).
--   · Eliminação de conta apaga tudo em cascata (ADR 0002). Por isso não há
--     coluna `deleted_at` em `profiles`: um perfil eliminado não existe, e uma
--     coluna que nunca é lida é uma excepção à espera de ser esquecida numa
--     política.
--   · Não existe `followers_count` nem equivalente. Proibição permanente.

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ── Tipos ────────────────────────────────────────────────────────────────────

create type public.title_kind as enum ('movie', 'tv');

-- O que se pode avaliar. `show` é a série inteira; `episode` é um episódio.
create type public.subject_type as enum ('movie', 'show', 'episode');

-- ── profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        citext not null unique
                  check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text
                  check (display_name is null or length(display_name) between 1 and 40),
  -- Caminho no Storage, nunca uma URL. Quem compõe a URL é o cliente.
  avatar_path   text,
  -- Regra 2: privado por omissão. Um default `false` seria uma fuga por
  -- inércia — a maioria das contas nunca muda o valor de omissão.
  is_private    boolean not null default true,
  -- Contador materializado do Círculo. É isto que torna o limite de 30 à prova
  -- de concorrência; ver a migração do grafo social. Ninguém escreve aqui
  -- directamente: a política de UPDATE de `profiles` exclui esta coluna.
  circle_count  smallint not null default 0
                  check (circle_count between 0 and 30),
  created_at    timestamptz not null default now()
);

comment on column public.profiles.circle_count is
  'Mantido por trigger em circle_members. O UPDATE toma um lock de linha, e é '
  'essa serialização que impede o 30.º e o 31.º membro de passarem em '
  'simultâneo. Um select count(*) num trigger não resistiria.';

-- ── Metadados do TMDB ────────────────────────────────────────────────────────
-- Não são dados de utilizador. Legíveis por qualquer autenticado; escritos só
-- pelas Edge Functions da Fase 2, com `service_role`.

create table public.titles (
  id              uuid primary key default gen_random_uuid(),
  tmdb_id         integer not null,
  kind            public.title_kind not null,
  title           text not null,
  original_title  text,
  year            smallint check (year is null or year between 1870 and 2200),
  -- Só o caminho. O tamanho e o domínio são escolhidos no cliente a partir de
  -- uma lista fechada; guardar a URL inteira fixaria uma decisão do TMDB na
  -- nossa base de dados.
  poster_path     text,
  overview        text,
  lang            text,
  -- Se uma série ainda está em emissão, para saber quando revalidar.
  status          text,
  fetched_at      timestamptz not null default now(),
  ttl             interval not null default interval '7 days',
  unique (tmdb_id, kind)
);

create table public.seasons (
  id        uuid primary key default gen_random_uuid(),
  title_id  uuid not null references public.titles (id) on delete cascade,
  -- 0 é a temporada de especiais. Permitido de propósito.
  number    smallint not null check (number >= 0),
  name      text,
  unique (title_id, number)
);

create table public.episodes (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid not null references public.seasons (id) on delete cascade,
  number     smallint not null check (number >= 0),
  name       text,
  air_date   date,
  unique (season_id, number)
);

-- ── watched ──────────────────────────────────────────────────────────────────
-- Pré-condição das notas de episódio: ver a nota de episódio de alguém exige
-- Círculo E ter visto esse episódio. Sem esta tabela a regra 3 não é
-- verificável no motor.

create table public.watched (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  episode_id  uuid not null references public.episodes (id) on delete cascade,
  watched_at  timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- ── Perfil criado com a conta ────────────────────────────────────────────────
-- Sem isto, existiria uma janela entre o registo e a criação do perfil em que
-- `auth.uid()` não corresponde a nenhuma linha de `profiles` — e todas as
-- políticas que consultam `profiles` falhariam em silêncio nessa janela.

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'handle',
      'u' || replace(new.id::text, '-', '')
    ),
    new.raw_user_meta_data ->> 'display_name'
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'security definer porque escreve em public.profiles a partir de um trigger '
  'em auth.users, onde o chamador não tem privilégios. Ver docs/adr/0003. '
  'Não lê nada e não decide visibilidade.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Activar já, com as políticas na migração de F1-5. Uma tabela criada sem RLS
-- e activada mais tarde é uma janela de exposição; activar sem políticas é
-- fechado por omissão, que é o lado certo para errar.

alter table public.profiles enable row level security;
alter table public.titles   enable row level security;
alter table public.seasons  enable row level security;
alter table public.episodes enable row level security;
alter table public.watched  enable row level security;
