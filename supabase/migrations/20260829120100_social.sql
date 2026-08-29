-- F1-2 · Grafo social
--
-- follows, circle_members, blocks, reports e o registo de auditoria de
-- moderação. As regras que aqui vivem no motor, e não no cliente:
--
--   · seguir um perfil privado entra em `pending`, e o cliente não escolhe;
--   · o Círculo exige `follows` activo nos dois sentidos;
--   · o Círculo tem no máximo 30 membros, mesmo com escritas em simultâneo;
--   · bloquear demole a relação, não a esconde.

create type public.follow_state  as enum ('pending', 'active');
create type public.report_subject as enum ('profile', 'reply', 'rating');
create type public.report_reason  as enum (
  'spam', 'assedio', 'discurso_de_odio', 'conteudo_sexual',
  'personificacao', 'auto_mutilacao', 'outro'
);
create type public.report_state   as enum ('open', 'dismissed', 'removed', 'suspended');

-- ── follows ──────────────────────────────────────────────────────────────────

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  followee_id  uuid not null references public.profiles (id) on delete cascade,
  state        public.follow_state not null default 'pending',
  created_at   timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- O estado inicial é derivado da privacidade do alvo, não enviado pelo cliente.
-- Um cliente que envie `state = 'active'` sobre um perfil privado é corrigido
-- aqui; se isto fosse lógica de cliente, seria a política de visibilidade
-- inteira a cair.
--
-- `security definer` é obrigatório e não uma escolha: como `invoker`, a leitura
-- de `profiles.is_private` está sujeita à política de `profiles`, e quem segue
-- um perfil privado por definição ainda não o vê. `alvo_privado` vinha NULL, o
-- `case` caía no ramo `else` e QUALQUER estranho conseguia seguir um perfil
-- privado directamente em `active`. A regra 2 caía inteira, em silêncio. O
-- teste 020, caso 7, é este bug.
create function public.follows_forcar_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  alvo_privado boolean;
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id, b.blocked_id) in (
      (new.follower_id, new.followee_id),
      (new.followee_id, new.follower_id)
    )
  ) then
    raise exception 'seguir impossível entre contas bloqueadas'
      using errcode = 'check_violation';
  end if;

  select p.is_private into alvo_privado
  from public.profiles p where p.id = new.followee_id;

  new.state := case when alvo_privado then 'pending' else 'active' end;
  return new;
end;
$fn$;

create trigger follows_estado_inicial
  before insert on public.follows
  for each row execute function public.follows_forcar_estado();

-- Um pedido só transita de pending para active. Nunca ao contrário por UPDATE,
-- e nunca muda de pessoas.
create function public.follows_transicao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if new.follower_id <> old.follower_id or new.followee_id <> old.followee_id then
    raise exception 'um follow não muda de pessoas' using errcode = 'check_violation';
  end if;
  if old.state = 'active' and new.state = 'pending' then
    raise exception 'para recusar, apaga a linha' using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

create trigger follows_transicao_valida
  before update on public.follows
  for each row execute function public.follows_transicao();

-- ── circle_members ───────────────────────────────────────────────────────────

create table public.circle_members (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, member_id),
  check (owner_id <> member_id)
);

-- Reciprocidade. Depende de duas linhas de outra tabela, por isso é trigger e
-- não CHECK, e dá uma mensagem do domínio em vez de um 403 opaco.
--
-- `security definer` pela mesma razão do trigger acima: a política de `blocks`
-- esconde de propósito, de quem é bloqueado, o facto de o ser — logo, como
-- `invoker`, este trigger nunca veria um bloqueio feito na direcção contrária
-- e deixaria formar Círculo com quem me bloqueou.
create function public.circulo_reciproco()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id, b.blocked_id) in (
      (new.owner_id, new.member_id), (new.member_id, new.owner_id)
    )
  ) then
    raise exception 'não há Círculo com quem está bloqueado'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.follows f
    where f.follower_id = new.owner_id
      and f.followee_id = new.member_id
      and f.state = 'active'
  ) or not exists (
    select 1 from public.follows f
    where f.follower_id = new.member_id
      and f.followee_id = new.owner_id
      and f.state = 'active'
  ) then
    raise exception 'o Círculo exige que se sigam nos dois sentidos'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$fn$;

create trigger circulo_exige_reciprocidade
  before insert on public.circle_members
  for each row execute function public.circulo_reciproco();

-- O limite de 30.
--
-- Este UPDATE é a defesa inteira. Ele adquire um lock na linha de `profiles`,
-- por isso duas transacções a inserir o 30.º e o 31.º membro serializam-se
-- neste ponto: a segunda espera, lê o valor já commitado, avalia o CHECK
-- (circle_count <= 30) e falha.
--
-- Um trigger que fizesse `select count(*) from circle_members` não resistiria:
-- em read committed as duas transacções contam 29, ambas passam, ambas
-- commitam, e o Círculo fica com 31 pessoas sem um único erro no log.
create function public.circulo_contar()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  -- Marca de transacção que autoriza este UPDATE, e só este. A protecção de
  -- `circle_count` em F1-5 lê-a. Sem isto, a defesa que impede o contador de
  -- ser escrito impediria também o motor de o manter.
  perform set_config('nota.contador', 'on', true);
  if tg_op = 'INSERT' then
    update public.profiles
       set circle_count = circle_count + 1
     where id = new.owner_id;
  else
    update public.profiles
       set circle_count = circle_count - 1
     where id = old.owner_id;
  end if;
  perform set_config('nota.contador', 'off', true);
  if tg_op = 'INSERT' then return new; else return old; end if;
end;
$fn$;

create trigger circulo_contador
  after insert or delete on public.circle_members
  for each row execute function public.circulo_contar();

-- ── blocks ───────────────────────────────────────────────────────────────────

create table public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

comment on table public.blocks is
  'A direcção existe só para saber quem pode desfazer. O efeito é simétrico: quem bloqueia e quem é bloqueado deixam de se ver, nos dois sentidos.';

-- Bloquear demole a relação. Se fosse apenas um filtro de leitura, cada
-- política nova teria de se lembrar de o aplicar — e uma há-de esquecer-se.
--
-- `security definer` porque tem de apagar linhas de OUTRA pessoa: a política de
-- `circle_members` só permite apagar as do próprio dono, portanto como
-- `invoker` o bloqueio limpava o meu lado e deixava o outro intacto.
create function public.bloqueio_demolir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  delete from public.follows
   where (follower_id, followee_id) in (
     (new.blocker_id, new.blocked_id), (new.blocked_id, new.blocker_id)
   );
  delete from public.circle_members
   where (owner_id, member_id) in (
     (new.blocker_id, new.blocked_id), (new.blocked_id, new.blocker_id)
   );
  return new;
end;
$fn$;

create trigger bloqueio_demole_relacao
  after insert on public.blocks
  for each row execute function public.bloqueio_demolir();

-- ── reports e auditoria ──────────────────────────────────────────────────────

create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  reporter_id   uuid not null references public.profiles (id) on delete cascade,
  -- Excepção deliberada ao cascade do ADR 0002: uma denúncia que desaparece
  -- quando o denunciado apaga a conta é um mecanismo de evasão à moderação.
  -- O handle fica copiado em texto para a denúncia continuar legível.
  reported_id      uuid references public.profiles (id) on delete set null,
  reported_handle  text,
  subject_type  public.report_subject not null,
  subject_id    uuid not null,
  -- Enum fechado, não texto livre: uma razão categorizada é moderável em
  -- escala, um campo livre não é.
  reason        public.report_reason not null,
  note          text check (note is null or length(note) <= 500),
  state         public.report_state not null default 'open',
  created_at    timestamptz not null default now(),
  -- Retenção de 180 dias (ADR 0002). A coluna existe desde já porque
  -- acrescentá-la a uma tabela com dados obrigaria a inventar um valor para as
  -- linhas antigas.
  -- Coluna gerada seria o ideal, mas `timestamptz + interval` depende do fuso
  -- da sessão e o Postgres recusa-a como não imutável. Default calculado, e o
  -- valor é imposto por trigger para não ser escolhido por quem denuncia.
  expires_at    timestamptz not null default (now() + interval '180 days')
);

create table public.moderation_audit (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references public.reports (id) on delete set null,
  actor       text not null,
  action      text not null,
  detail      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '2 years')
);

comment on table public.moderation_audit is
  'Retenção de 2 anos (ADR 0002). Invisível a utilizadores: não tem uma única política de SELECT, e com RLS activo isso significa zero linhas para todos.';

-- Expurgo. Chamado por cron a partir da Fase 4; existe já para que a retenção
-- seja uma propriedade do esquema e não uma intenção num documento.
create function public.purgar_retencao()
returns table (reports_apagados bigint, auditoria_apagada bigint)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  a bigint;
  b bigint;
begin
  delete from public.reports where expires_at < now();
  get diagnostics a = row_count;
  delete from public.moderation_audit where expires_at < now();
  get diagnostics b = row_count;
  return query select a, b;
end;
$fn$;

revoke execute on function public.purgar_retencao() from public, anon, authenticated;

comment on function public.purgar_retencao() is
  'security definer porque apaga linhas que nenhum utilizador pode sequer ler. Ver docs/adr/0003. Execute revogado a anon e authenticated: só service_role.';

-- A retenção não é uma sugestão: quem insere não escolhe a data de expiração.
create function public.forcar_retencao()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.expires_at := new.created_at + case tg_table_name
    when 'reports' then interval '180 days'
    else interval '2 years'
  end;
  return new;
end;
$fn$;

create trigger reports_retencao
  before insert or update on public.reports
  for each row execute function public.forcar_retencao();

create trigger moderation_audit_retencao
  before insert or update on public.moderation_audit
  for each row execute function public.forcar_retencao();

alter table public.follows          enable row level security;
alter table public.circle_members   enable row level security;
alter table public.blocks           enable row level security;
alter table public.reports          enable row level security;
alter table public.moderation_audit enable row level security;
