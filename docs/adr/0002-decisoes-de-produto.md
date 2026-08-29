# ADR 0002 — Decisões de produto que fixam o esquema

- Estado: aceite
- Data: 2026-08-29
- Decisor: dono do produto (resposta directa)
- Consequência imediata: desbloqueia F1-1, F1-2, F1-5 e F1-6

## Contexto

Quatro decisões estavam marcadas como bloqueantes em `docs/plano/fase-0-1.md`.
Todas elas se traduzem em estrutura de base de dados, não em comportamento de
cliente, e todas são caras de mudar depois de existirem dados. Foram fechadas
antes de se escrever a primeira migração.

## Decisão 1 — Eliminação de conta: apagar tudo

Todas as chaves estrangeiras que apontam para `profiles.id` são
`ON DELETE CASCADE`. Eliminar a conta apaga rankings, `watched`, respostas,
reacções, `follows`, `circle_members` e `blocks`.

Porquê: é a leitura mais simples do requisito da Apple e a única que não obriga
a manter um perfil-fantasma vivo em todas as políticas RLS. Uma coluna
`deleted_at` num perfil anonimizado seria uma excepção a acrescentar a cada
política — e cada excepção numa política RLS é uma superfície de ataque.

Custo aceite: uma resposta a um utilizador eliminado desaparece, e o fio de
conversa de terceiros fica com um buraco. O `contexto` de uma resposta vive na
nota a que responde, não na resposta anterior, por isso o buraco é tolerável.

Excepção deliberada: `reports` **não** faz cascade sobre o denunciado. Uma
denúncia que desaparece quando o denunciado apaga a conta é um mecanismo de
evasão à moderação. `reports.reported_id` é `ON DELETE SET NULL`, com o handle
copiado em texto no momento da denúncia. Ver decisão 4.

## Decisão 2 — Notas de episódio: sempre exclusivas do Círculo

A política RLS de leitura de notas de episódio exige pertença ao Círculo,
independentemente de o perfil ser público ou privado. O estado do perfil não
entra na condição.

Porquê: regra 3 do `CLAUDE.md` lida à letra. Uma política com um ramo
`OR perfil público` teria de repetir a verificação de nota cega e de bloqueio
dentro desse ramo, e é exactamente aí que aparecem os buracos. A condição fica:
Círculo **e** `watched` para esse episódio **e** bucket próprio **e** não
bloqueado — quatro conjunções, zero disjunções.

## Decisão 3 — Feed: apenas o Círculo

Um único feed, alimentado por `circle_members`. Não há separador "A seguir".

Porquê: o feed nunca lê `follows`, o que elimina metade dos índices previstos em
F1-6 e a pergunta de como ordenar duas fontes com densidades diferentes. Seguir
alguém fora do Círculo continua a servir para ver o perfil e as notas de título
(sujeitas a nota cega); simplesmente não produz feed.

Consequência para F1-6: `circle_members(owner_id, member_id)` é o índice que o
feed usa. Nenhum índice de feed sobre `follows`.

## Decisão 4 — Retenção: denúncias 180 dias, auditoria 2 anos

`reports` tem `expires_at` calculado a `created_at + 180 days`.
`moderation_audit` tem `expires_at` a `created_at + 2 years`. Uma função de
expurgo apaga o que passou a data; corre por cron a partir da Fase 4, mas as
colunas existem desde F1-2 — acrescentar uma coluna de retenção a uma tabela com
dados obriga a inventar um valor para as linhas antigas.

Porquê: 180 dias chega para ver reincidência sem reter denúncias
indefinidamente; 2 anos de auditoria cobrem uma disputa de conta. Ambos os
prazos são declaráveis nas etiquetas de privacidade da App Store sem asterisco.

## Alternativas rejeitadas

- **Anonimizar em vez de apagar.** Rejeitada por multiplicar os ramos das
  políticas RLS. Se um dia for preciso, é uma migração de `CASCADE` para
  `SET NULL` mais uma coluna — dolorosa, mas não impossível.
- **Feed com duas tabs.** Rejeitada por ser reversível: acrescentar o separador
  "A seguir" na Fase 5 custa um índice e uma query. Construir agora custa isso
  mais a manutenção de tudo o que for feito por cima.
