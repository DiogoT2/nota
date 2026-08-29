# Veredicto da Fase 1

- Data: 2026-08-29
- Alvo: `supabase/migrations/` na sua totalidade, base local reconstruída do zero
- Plano de ataque: `docs/ataque-fase-1.md`
- Reprodução: `npm run db:reset && npm run db:test && npm run db:ataque && npm run db:ataque:rest`

## Veredicto

**PASSA.** Nenhum dos ataques executados obteve o que procurava.

Não é uma declaração de que o esquema é seguro. É a declaração de que 85
tentativas específicas falharam, e de que estão escritas de forma a voltarem a
correr em cada alteração. A lista do que ficou por testar está no fim, e é a
parte mais importante deste documento.

## O que correu

| Bateria                                        | Onde                                | Ataques   | Resultado |
| ---------------------------------------------- | ----------------------------------- | --------- | --------- |
| Estrutura                                      | `supabase/tests/000-estrutura.sql`  | 11        | passa     |
| Nota cega (regra 1)                            | `010-nota-cega.sql`                 | 12        | passa     |
| Visibilidade, Círculo, bloqueio (regras 2 e 3) | `020-visibilidade-circulo.sql`      | 22        | passa     |
| Escrita e limites                              | `030-escrita.sql`                   | 14        | passa     |
| Limite de 30 sob concorrência                  | `scripts/ataque-limite-circulo.mjs` | 20 rondas | passa     |
| PostgREST, de fora                             | `scripts/ataque-postgrest.mjs`      | 26        | passa     |

Os pgTAP atacam de dentro da base, com `set role authenticated` e claims
forjadas. A bateria do PostgREST ataca pela porta por onde a app entra — a
mesma que um telemóvel com o certificado desafixado usa. As duas são precisas:
o PostgREST acrescenta superfície que a RLS sozinha não cobre (contagens,
embeds, upserts, agregações, e mensagens de erro que distinguem «não existe» de
«não podes ver»).

## Os quatro bugs que estas baterias encontraram

Nenhum foi encontrado por leitura do SQL. Todos por um teste a falhar.

1. **Recursão infinita na política de `buckets`.** A política de leitura
   consultava a própria tabela para verificar a nota cega, e o Postgres aborta.
   Resolvido com `tenho_balde()`, `security definer`, que só olha para as linhas
   do próprio chamador.

2. **Qualquer estranho podia seguir um perfil privado directamente em `active`.**
   O trigger que deriva o estado do pedido era `security invoker`, e portanto a
   leitura de `profiles.is_private` estava sujeita à política de `profiles` —
   que, por definição, esconde do estranho o perfil que ele quer seguir. A
   variável vinha `NULL`, o `case` caía no ramo `else`, e a **regra 2 caía
   inteira, sem um único erro**. Este é o bug mais grave dos quatro e o mais
   difícil de ver a ler o código: cada linha, isoladamente, está certa.

3. **Bloquear limpava só metade da relação.** `bloqueio_demolir` era `invoker` e
   a política de `circle_members` só permite apagar as linhas do próprio dono —
   portanto o bloqueio tirava a outra pessoa do meu Círculo e deixava-me no
   dela.

4. **A reciprocidade do Círculo não via bloqueios na direcção contrária.** A
   política de `blocks` esconde, de propósito, de quem é bloqueado o facto de o
   ser. Como `invoker`, o trigger nunca via esse lado, e deixava formar Círculo
   com quem me tinha bloqueado.

Os quatro são a mesma família: **um trigger ou predicado que corre com os olhos
do utilizador não consegue impor uma regra que depende de dados que esse
utilizador não pode ver.** Está registado no ADR 0003, função a função.

## Provas que exigiram método próprio

**`security_invoker = on` na vista `scores`.** Verificado contra
`pg_class.reloptions`, não por leitura do ficheiro de migração. Sem essa opção a
vista correria como dona e devolveria as notas de toda a gente a toda a gente —
seria o buraco que o resto do esquema existe para fechar.

**RLS em todas as tabelas.** Uma varredura sobre `pg_class`, não uma lista de
nomes. Uma lista tem de ser mantida à mão, e a tabela que alguém se esquecer de
lá pôr é exactamente a que vai ficar sem RLS.

**O limite de 30 sob concorrência.** Não cabe em pgTAP, que corre numa sessão
só. `scripts/ataque-limite-circulo.mjs` abre duas ligações a sério e corre a
corrida 20 vezes. **O teste foi validado ao contrário**: substituindo o trigger
por um `select count(*)`, o Círculo chega a 31 em 5 de 5 rondas. Um teste que
nunca falha não prova nada.

**Regra 4, a nota não é uma coluna.** Uma varredura por `pg_attribute` à procura
de `score`, `rating`, `nota`, `stars` ou `grade` em qualquer tabela. `taste_match`
tem uma coluna de afinidade que foi deliberadamente chamada `affinity` e não
`score`, para que este teste não tenha falsos positivos — um detector com
falsos positivos treina quem o lê a ignorá-lo.

## Uma propriedade que não é um bug, mas tem de ser dita

Um JWT assinado com o **segredo verdadeiro** e a reclamar `role: service_role` é
aceite e ignora a RLS por completo. Foi verificado. Não é uma falha da política:
é a definição do segredo — é com ele que a própria chave `service_role` é
emitida.

A consequência operacional não é corrigir nada no esquema. É que o segredo do
JWT nunca entra num bundle nem num repositório, que os três ambientes têm
segredos diferentes, e que rodá-lo é a resposta a qualquer suspeita de fuga.
Está em `docs/ambientes.md`, e `npm run check:secrets` corre no CI a exportar o
bundle a sério e a procurar lá dentro.

O ataque que fica no relatório é o defensável: **sem** o segredo, a mesma
reclamação de `service_role` devolve 401.

## O que NÃO foi testado

Esta secção é a que dá valor ao veredicto.

1. **Realtime.** As subscrições de `postgres_changes` são configuração separada
   da RLS. Uma tabela na publicação com autorização mal posta transmite as
   alterações a quem estiver a ouvir, e nenhuma destas baterias o veria. Nada
   está publicado neste momento; a primeira tabela a ser publicada precisa de
   uma bateria própria.

2. **Oráculos de latência.** Uma política que faz mais trabalho quando a linha
   existe do que quando não existe é distinguível pelo tempo de resposta. Com
   uma base de dezenas de linhas, a medição é ruído. Precisa de volume, e
   portanto de um seed grande que ainda não existe.

3. **Storage.** `avatar_path` aponta para um bucket do Supabase Storage que
   ainda não foi criado. As políticas de Storage são outro sistema de RLS, com
   as suas próprias regras, e não foram tocadas.

4. **Enumeração por `profile_cards`.** A vista é uma abertura deliberada e
   documentada: qualquer pessoa com sessão pode listar todos os perfis, com
   handle e nome. É o que qualquer pesquisa de utilizadores faz, mas continua a
   ser enumeração do universo de contas. Sem rate limiting, é gratuita.

5. **`GET /rest/v1/` — o esquema aberto.** O PostgREST expõe a definição das
   tabelas a quem tem sessão. Não revela dados, revela a forma do esquema.
   Assumido.

6. **Apagar o balde depois de ler.** O ataque A5 confirma que apagar a própria
   avaliação volta a fechar o acesso — mas o que já foi lido, foi lido. Não é
   remediável por RLS. Se o produto quiser impedi-lo, precisa de retenção ou de
   custo em apagar, e isso é decisão de produto.

## Fecho

A Fase 1 fecha. A Fase 2 pode arrancar.

Condição que se mantém: qualquer alteração a `supabase/migrations/` volta a
correr estas baterias, e uma única falha bloqueia o merge. Está no CI, em
`.github/workflows/ci.yml`, no job `base-de-dados`.
