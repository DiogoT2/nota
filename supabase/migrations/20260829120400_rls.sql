-- F1-5 · Políticas RLS
--
-- As regras 1 a 3 do produto vivem aqui e em mais lado nenhum. Um ecrã que
-- esconda uma nota que a base devolveria não é uma nota cega; é uma fuga com
-- uma cortina à frente.
--
-- Duas notas de método que explicam quase todas as decisões deste ficheiro:
--
-- 1. Políticas PERMISSIVE somam-se com OR. A nota cega tem três condições que
--    têm de valer todas ao mesmo tempo, por isso é UMA política com AND. Se
--    fossem três políticas separadas, bastaria uma para abrir tudo — e seria o
--    tipo de erro que passa despercebido numa revisão, porque cada uma das três
--    linhas está certa isoladamente.
--
-- 2. Os predicados auxiliares são `security definer`. Não por conveniência: sem
--    isso há recursão infinita (a política de `profiles` teria de ler
--    `profiles`) e o bloqueio deixaria de ser simétrico (a política de `blocks`
--    esconde de propósito, de quem é bloqueado, o facto de o ser — portanto uma
--    função `invoker` nunca veria esse lado do bloqueio). Ver docs/adr/0003.

-- ── Predicados auxiliares ────────────────────────────────────────────────────

-- Existe bloqueio em qualquer direcção entre quem pergunta e `other`.
create function public.blocked(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = other)
        or (b.blocker_id = other and b.blocked_id = auth.uid())
  );
$fn$;

-- Posso ver o perfil de `other`: sou eu, ou é público, ou sigo-o e o pedido foi
-- aceite. E, em qualquer dos casos, não há bloqueio.
--
-- O `not blocked()` está DENTRO deste predicado, e não ao lado dele em cada
-- política, precisamente para que nenhuma política futura se possa esquecer
-- dele.
create function public.visible_profile(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    not public.blocked(other)
    and (
      other = auth.uid()
      or exists (select 1 from public.profiles p
                  where p.id = other and p.is_private = false)
      or exists (select 1 from public.follows f
                  where f.follower_id = auth.uid()
                    and f.followee_id = other
                    and f.state = 'active')
    );
$fn$;

-- «Eu avaliei este título?» — o predicado da nota cega.
--
-- Tem de ser `security definer` por uma razão estrutural, não por comodidade:
-- a política de leitura de `buckets` precisa de consultar `buckets`, e uma
-- subconsulta sobre a mesma tabela reentra na política e o Postgres aborta com
-- «infinite recursion detected in policy». A mesma subconsulta dentro da
-- política de `rank_positions` recairia na política de `buckets` e recursaria
-- na mesma.
--
-- É seguro porque a função só olha para as linhas do próprio chamador: filtra
-- por `auth.uid()` e devolve um booleano. Não há nenhuma entrada que a faça
-- responder sobre outra pessoa.
create function public.tenho_balde(t public.subject_type, s uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.buckets b
     where b.user_id = auth.uid()
       and b.subject_type = t
       and b.subject_id = s
  );
$fn$;

-- `other` está no MEU Círculo. O Círculo é do dono: que eu esteja no dele não
-- implica que ele esteja no meu.
create function public.in_my_circle(other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    not public.blocked(other)
    and exists (
      select 1 from public.circle_members c
       where c.owner_id = auth.uid() and c.member_id = other
    );
$fn$;

-- Só quem tem sessão. `anon` não tem nada para fazer nesta base.
revoke execute on function public.blocked(uuid)         from public, anon;
revoke execute on function public.visible_profile(uuid) from public, anon;
revoke execute on function public.in_my_circle(uuid)    from public, anon;
revoke execute on function public.tenho_balde(public.subject_type, uuid) from public, anon;
grant  execute on function public.blocked(uuid)         to authenticated;
grant  execute on function public.visible_profile(uuid) to authenticated;
grant  execute on function public.in_my_circle(uuid)    to authenticated;
grant  execute on function public.tenho_balde(public.subject_type, uuid) to authenticated;

-- ── profiles ─────────────────────────────────────────────────────────────────

create policy profiles_ler on public.profiles
  for select to authenticated
  using (public.visible_profile(id));

create policy profiles_criar on public.profiles
  for insert to authenticated
  with check (id = (select auth.uid()));

create policy profiles_actualizar on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Sem política de DELETE: apagar a conta faz-se em `auth.users`, e o cascade
-- trata do resto (ADR 0002). Um DELETE directo em `profiles` deixaria uma conta
-- de autenticação órfã, que voltaria a criar perfil no próximo login.

-- `circle_count` é o limite de 30 materializado. Se pudesse ser escrito por
-- quem quer que seja, o limite contornava-se com um PATCH a pôr o contador a
-- zero.
--
-- Duas defesas. A primeira é uma lista de colunas escrevíveis, e não um revoke
-- da coluna do contador: `revoke update (circle_count)` NÃO FAZ NADA enquanto o
-- papel tiver `UPDATE` na tabela, porque o privilégio de tabela implica todas
-- as colunas. Foi verificado com `has_column_privilege`, que devolvia `true`
-- depois do revoke.
--
-- A lista é também a escolha certa por omissão: uma coluna nova nasce sem
-- permissão de escrita até alguém a acrescentar aqui de propósito. O contrário
-- — tirar permissões coluna a coluna — obriga a lembrar-se de cada coluna nova,
-- e é a que se esquecer que fica exposta.
revoke update on public.profiles from authenticated;
grant update (handle, display_name, avatar_path, is_private)
  on public.profiles to authenticated;

create function public.profiles_proteger_contador()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if new.circle_count is distinct from old.circle_count then
    raise exception 'circle_count é mantido pelo motor, não se escreve'
      using errcode = 'insufficient_privilege';
  end if;
  if new.id is distinct from old.id then
    raise exception 'um perfil não muda de dono' using errcode = 'check_violation';
  end if;
  return new;
end;
$fn$;

-- A excepção é o próprio trigger do contador, que marca a transacção antes de
-- escrever. Guardar pelo nome do papel não serviria: o seed, as migrações e as
-- Edge Functions correm com papéis diferentes, e a lista de excepções seria
-- adivinhação.
create trigger profiles_contador_protegido
  before update on public.profiles
  for each row
  when (current_setting('nota.contador', true) is distinct from 'on')
  execute function public.profiles_proteger_contador();

-- O cartão mínimo de um perfil.
--
-- Abertura deliberada: para se poder pedir para seguir alguém privado, é
-- preciso vê-lo existir. Esta vista corre com os privilégios do dono (NÃO tem
-- security_invoker) e é por isso a única coisa neste esquema que passa por cima
-- de uma política. Expõe quatro colunas e mais nenhuma, e respeita o bloqueio.
--
-- O que ela custa: permite enumerar quem tem conta. É o mesmo que qualquer
-- pesquisa de utilizadores de qualquer app social, e é a razão de não existir
-- aqui uma função `handle_available` — seria um segundo oráculo para a mesma
-- informação, com um `security definer` a mais.
create view public.profile_cards as
  select p.id, p.handle, p.display_name, p.avatar_path, p.is_private
    from public.profiles p
   where not public.blocked(p.id);

revoke all on public.profile_cards from public, anon;
grant select on public.profile_cards to authenticated;

comment on view public.profile_cards is
  'Abertura deliberada e auditada: quatro colunas de qualquer perfil, para se poder pedir para seguir. Sem security_invoker de propósito. Qualquer coluna acrescentada aqui é uma fuga.';

-- ── Metadados do TMDB ────────────────────────────────────────────────────────
-- Não são dados de utilizador. Leitura para quem tem sessão; escrita só por
-- `service_role`, a partir das Edge Functions da Fase 2 — e `service_role`
-- ignora RLS, por isso não precisa de política nenhuma.

create policy titles_ler   on public.titles   for select to authenticated using (true);
create policy seasons_ler  on public.seasons  for select to authenticated using (true);
create policy episodes_ler on public.episodes for select to authenticated using (true);

-- ── follows ──────────────────────────────────────────────────────────────────

-- Só se vê o que nos diz respeito. É isto que impede reconstruir uma contagem
-- de seguidores por agregação — a proibição permanente não é «não mostrar o
-- número», é «não haver como o calcular».
create policy follows_ler on public.follows
  for select to authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

create policy follows_criar on public.follows
  for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and not public.blocked(followee_id)
  );

-- Aceitar um pedido: só quem foi seguido, e só quem está pendente. A transição
-- válida é imposta pelo trigger `follows_transicao_valida`.
create policy follows_aceitar on public.follows
  for update to authenticated
  using (followee_id = (select auth.uid()) and state = 'pending')
  with check (followee_id = (select auth.uid()));

-- Deixar de seguir, ou tirar um seguidor. Os dois lados podem desfazer.
create policy follows_apagar on public.follows
  for delete to authenticated
  using (
    follower_id = (select auth.uid())
    or followee_id = (select auth.uid())
  );

-- ── circle_members ───────────────────────────────────────────────────────────
-- O Círculo de terceiros não é visível a ninguém. Saber quem está no Círculo de
-- quem é o mapa social inteiro.

create policy circulo_ler on public.circle_members
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy circulo_criar on public.circle_members
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy circulo_apagar on public.circle_members
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ── blocks ───────────────────────────────────────────────────────────────────
-- Quem é bloqueado não sabe que o é: não existe política que lho revele. É por
-- isto que `blocked()` tem de ser `security definer` — nem o próprio motor
-- conseguiria ver esse lado com uma função `invoker`.

create policy blocks_ler on public.blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy blocks_criar on public.blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy blocks_apagar on public.blocks
  for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- ── reports ──────────────────────────────────────────────────────────────────

create policy reports_ler on public.reports
  for select to authenticated
  using (reporter_id = (select auth.uid()));

create policy reports_criar on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()));

-- Sem UPDATE nem DELETE: mudar o estado de uma denúncia é moderação, e faz-se
-- com `service_role`. `moderation_audit` não tem uma única política — com RLS
-- activo, isso significa zero linhas para toda a gente.

-- ── buckets ──────────────────────────────────────────────────────────────────
--
-- REGRA 1, primeira metade. Ver que alguém avaliou um título exige ter-se
-- avaliado o mesmo título.

create policy buckets_ler on public.buckets
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.visible_profile(user_id)
      and public.tenho_balde(buckets.subject_type, buckets.subject_id)
    )
  );

create policy buckets_criar on public.buckets
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy buckets_actualizar on public.buckets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy buckets_apagar on public.buckets
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── rank_positions ───────────────────────────────────────────────────────────
--
-- REGRA 1 e REGRA 3. A política mais importante do esquema.
--
-- UMA política, com AND. Três políticas PERMISSIVE somar-se-iam com OR e cada
-- uma delas abriria sozinha o que as outras duas fecham.
--
-- As condições, por ordem:
--   · é minha; ou então, tudo o que se segue ao mesmo tempo —
--   · posso ver o perfil (regra 2, e o bloqueio vem lá dentro);
--   · tenho balde próprio para o mesmo título (regra 1, a nota cega);
--   · e, se for episódio, ele está no meu Círculo E eu vi esse episódio
--     (regra 3, com a decisão do ADR 0002: episódios são sempre do Círculo,
--     mesmo em perfil público — sem ramo `OR perfil público`).

create policy rank_positions_ler on public.rank_positions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.visible_profile(user_id)
      and public.tenho_balde(rank_positions.subject_type, rank_positions.subject_id)
      and (
        rank_positions.subject_type <> 'episode'
        or (
          public.in_my_circle(rank_positions.user_id)
          and exists (
            select 1 from public.watched w
             where w.user_id = (select auth.uid())
               and w.episode_id = rank_positions.subject_id
          )
        )
      )
    )
  );

create policy rank_positions_criar on public.rank_positions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy rank_positions_actualizar on public.rank_positions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy rank_positions_apagar on public.rank_positions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── watched ──────────────────────────────────────────────────────────────────

create policy watched_ler on public.watched
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.in_my_circle(user_id)
  );

create policy watched_criar on public.watched
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy watched_apagar on public.watched
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── reactions e replies ──────────────────────────────────────────────────────
--
-- A política de leitura NÃO repete a nota cega: exige que a nota alvo seja
-- visível, e a visibilidade da nota alvo já é a nota cega. A regra vive num
-- sítio só. Se um dia mudar, muda uma vez.
--
-- Escrever é exclusivo do Círculo (regra 3).

create policy reactions_ler on public.reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.rank_positions r
       where r.user_id = reactions.target_user_id
         and r.subject_type = reactions.target_subject_type
         and r.subject_id = reactions.target_subject_id
    )
  );

create policy reactions_criar on public.reactions
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.in_my_circle(target_user_id)
    and exists (
      select 1 from public.rank_positions r
       where r.user_id = reactions.target_user_id
         and r.subject_type = reactions.target_subject_type
         and r.subject_id = reactions.target_subject_id
    )
  );

create policy reactions_apagar on public.reactions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy replies_ler on public.replies
  for select to authenticated
  using (
    exists (
      select 1 from public.rank_positions r
       where r.user_id = replies.target_user_id
         and r.subject_type = replies.target_subject_type
         and r.subject_id = replies.target_subject_id
    )
  );

create policy replies_criar on public.replies
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.in_my_circle(target_user_id)
    and exists (
      select 1 from public.rank_positions r
       where r.user_id = replies.target_user_id
         and r.subject_type = replies.target_subject_type
         and r.subject_id = replies.target_subject_id
    )
  );

create policy replies_apagar on public.replies
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Sem UPDATE em `replies`: editar uma resposta depois de alguém reagir a ela
-- muda o que essa pessoa concordou. Apaga-se e escreve-se outra.

-- ── taste_match ──────────────────────────────────────────────────────────────
-- Exclusivo do Círculo (regra 3). Escrita só por `service_role`.

create policy taste_match_ler on public.taste_match
  for select to authenticated
  using (
    (
      (user_a = (select auth.uid()) and public.in_my_circle(user_b))
      or (user_b = (select auth.uid()) and public.in_my_circle(user_a))
    )
    -- Com pouca sobreposição, `affinity` é NULL e não há o que revelar; mas
    -- `overlap` sozinho já diria quantos títulos duas pessoas partilham.
    and overlap >= 5
  );
