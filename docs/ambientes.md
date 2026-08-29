# Ambientes e segredos

## Os três ambientes

|                    | `local`                              | `staging`                                   | `production`                            |
| ------------------ | ------------------------------------ | ------------------------------------------- | --------------------------------------- |
| Projecto Supabase  | contentor Docker na máquina          | projecto próprio                            | projecto próprio                        |
| Base de dados      | descartável                          | descartável                                 | **nunca se apaga**                      |
| `npm run db:reset` | sim                                  | sim, com aviso                              | recusado pelo guarda                    |
| Chave TMDB         | própria, de desenvolvimento          | própria                                     | própria                                 |
| Dados              | seed determinista, seis contas fixas | seed + testes manuais                       | pessoas reais                           |
| Migrações          | aplicadas por `db:reset`             | por `supabase db push` no merge para `main` | por `db push` manual, depois de staging |

Três projectos Supabase distintos, três conjuntos de chaves. Nenhuma chave é
partilhada entre ambientes: uma chave que serve em dois sítios significa que
um incidente num deles é um incidente nos dois.

`scripts/db-guard.mjs` corre antes de `supabase db reset` e recusa-se se a
`DATABASE_URL` não for local nem contiver `staging`. Ver F0-7.

## O que é público e o que não é

**Público, por desenho.** A URL do projecto e a chave `anon` entram no bundle
da app. Não é um descuido: quem protege os dados é a RLS. Se as políticas
estiverem certas, a chave `anon` num telemóvel não abre nada; se estiverem
erradas, escondê-la não fecha nada. É por isso que a Fase 1 tem veto do
`rls-adversary` e não uma revisão de código.

**Nunca no bundle.** `SUPABASE_SERVICE_ROLE_KEY` ignora a RLS por completo.
`TMDB_API_KEY` e `TMDB_READ_ACCESS_TOKEN` são nossos e têm quota. Vivem em
Edge Functions e nos segredos do CI. Nenhum ficheiro em `app/` ou `src/` pode
sequer nomear estas variáveis — é regra de ESLint, não convenção.

`npm run check:secrets` exporta o bundle a sério com `expo export` e procura lá
dentro os valores e os padrões. Corre no CI com valores-canário: se um deles
sair no bundle, o CI falha. Verificar apenas por leitura do código não provaria
nada, porque o que vai para o telemóvel é o output do bundler.

## Rotação

Rodar a chave `service_role` ou a do TMDB é: gerar nova no painel, actualizar
os segredos do GitHub e as variáveis das Edge Functions, revogar a antiga. A
app não precisa de ser republicada, porque nunca as viu.

Rodar a chave `anon` obriga a publicar uma versão nova. Só se justifica se as
políticas RLS estiverem erradas — e nesse caso o que se corrige são as
políticas.
