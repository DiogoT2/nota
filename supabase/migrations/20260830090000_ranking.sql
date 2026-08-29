-- F3-8 · Fase 3 no esquema
--
-- Três alterações, todas consequência de decisões de produto registadas em
-- docs/plano/fase-3.md. Nenhuma delas reabre a Fase 1: as políticas de leitura
-- não mudam, e os 59 testes pgTAP e os 26 ataques continuam a ter de passar.

-- ── D2 · O arrasto fica pregado ──────────────────────────────────────────────
--
-- Reordenar à mão marca o título. Nenhuma comparação futura o move sozinho; só
-- outro arrasto o desprega. «Soberana» lido à letra: se uma comparação pudesse
-- desfazer um arrasto, a pessoa faria o mesmo arrasto duas vezes e concluiria,
-- com razão, que a app não a ouve.
--
-- Custo assumido e registado: com o tempo o ranking enche-se de pontos fixos
-- que travam o algoritmo. Se isso doer, a saída é mostrar quais estão pregados
-- e deixar despregar — não é o algoritmo passar por cima.

alter table public.rank_positions
  add column pinned boolean not null default false;

comment on column public.rank_positions.pinned is
  'Posto à mão por arrasto. O motor de ranking não o inclui nas comparações e nunca o move sozinho. Ver docs/plano/fase-3.md, decisão D2.';

-- É uma coluna de dados do próprio utilizador, e a política de UPDATE de
-- `rank_positions` já restringe a escrita a `user_id = auth.uid()`.

-- ── D3 · Taste match precisa de 10 títulos em comum ──────────────────────────
--
-- Com 5, um título diferente move a percentagem em dezenas de pontos. Mostrar
-- um número que salta assim é pior do que não mostrar nada, porque as pessoas
-- confiam nele à mesma. É também uma superfície de fuga a menos.

drop policy taste_match_ler on public.taste_match;

create policy taste_match_ler on public.taste_match
  for select to authenticated
  using (
    (
      (user_a = (select auth.uid()) and public.in_my_circle(user_b))
      or (user_b = (select auth.uid()) and public.in_my_circle(user_a))
    )
    and overlap >= 10
  );

-- ── D1 · A derivação da nota deixa de ser provisória ─────────────────────────
--
-- A vista da Fase 1 espalhava as notas por todo o intervalo do balde, o que
-- fazia o primeiro «adorei» saltar de 9.0 para 10.0 assim que entrasse o
-- segundo. Os saltos maiores davam-se nos primeiros títulos, que é quando toda
-- a gente está.
--
-- Agora as notas abrem-se devagar: comprimidas ao centro com poucos títulos, a
-- usar o intervalo todo a partir de cinco.
--
--   1 título    9.0
--   2 títulos   9.3  8.8
--   3 títulos   9.5  9.0  8.5
--   4 títulos   9.8  9.3  8.8  8.3
--   5+         10.0  9.5  9.0  8.5  8.0
--
-- Um 10.0 passa a querer dizer: ganhou a pelo menos quatro.
--
-- ATENÇÃO: a mesma regra existe em TypeScript, em `src/ranking/derivar.ts`,
-- porque o cliente precisa de a mostrar antes de gravar. Duas implementações da
-- mesma regra divergem — é só uma questão de tempo. Há um teste que corre as
-- duas com os mesmos dados e compara valor a valor; se ele desaparecer, esta
-- vista e aquele ficheiro passam a ser dois produtos diferentes.

-- `drop` e não `create or replace`: a vista ganha a coluna `pinned` no meio, e
-- o `replace` só admite colunas novas no fim. Largar é a operação honesta.
drop view public.scores;

create view public.scores
with (security_invoker = on) as
with rankeado as (
  select
    r.user_id,
    r.subject_type,
    r.scope_id,
    r.subject_id,
    r.position,
    r.pinned,
    r.created_at,
    b.bucket,
    row_number() over (
      partition by r.user_id, r.subject_type, r.scope_id, b.bucket
      order by r.position
    ) as lugar,
    count(*) over (
      partition by r.user_id, r.subject_type, r.scope_id, b.bucket
    ) as no_balde
  from public.rank_positions r
  join public.buckets b
    on b.user_id = r.user_id
   and b.subject_type = r.subject_type
   and b.subject_id = r.subject_id
)
select
  user_id,
  subject_type,
  scope_id,
  subject_id,
  bucket,
  position,
  pinned,
  created_at,
  round(
    case
      -- Um só título no balde não tem ordem relativa nenhuma: fica no centro.
      -- Pôr no topo diria que é o melhor de uma lista de um.
      when no_balde = 1 then centro
      -- Multiplicar primeiro, dividir uma vez só, no fim.
      --
      -- A forma óbvia — `meia * (1 - 2*(lugar-1)/(no_balde-1))` — divide a
      -- meio e perde precisão: 2/3 em numeric é 0.666…, truncado, e o
      -- resultado saía 9.2499… onde devia sair 9.25 exacto. Arredondado a uma
      -- casa dava 9.2 aqui e 9.3 em TypeScript, para a mesma nota. Foi
      -- apanhado por `npm run check:derivacao` na primeira vez que correu.
      else centro
           + (meia * ((no_balde - 1) - 2 * (lugar - 1))) / (no_balde - 1)
    end,
    1
  )::numeric(3, 1) as score
from rankeado,
lateral (
  select
    case bucket when 'adorei' then 10.0 when 'gostei' then 7.9 else 4.9 end,
    case bucket when 'adorei' then 8.0  when 'gostei' then 5.0 else 0.0 end
) as intervalo (topo, base),
lateral (
  select
    (intervalo.topo + intervalo.base) / 2,
    -- A amplitude vai de 0 (um título) a 1 (cinco ou mais). É o que faz as
    -- notas abrirem-se devagar.
    ((intervalo.topo - intervalo.base) / 2)
      * least(1.0, (no_balde - 1)::numeric / 4)
) as forma (centro, meia);

comment on view public.scores is
  'A nota. Derivada, nunca escrita. security_invoker = on: herda as políticas de quem consulta. A derivação espelha src/ranking/derivar.ts e há um teste que compara as duas.';
