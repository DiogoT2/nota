# Nota

App social onde amigos partilham notas de filmes, séries e episódios.
As regras de produto estão em `.claude/CLAUDE.md` e não são negociáveis.

## Arrancar

Precisas de Node 22, Docker a correr e um clone limpo.

```sh
npm install        # instala e prepara o hook de pre-commit
npm run db:start   # Postgres, PostgREST, Auth e Studio em Docker
cp .env.example .env
npm start          # Expo
```

`npm run db:start` imprime a chave `anon` local. Copia-a para o `.env`.

## Comandos

|                         |                                                       |
| ----------------------- | ----------------------------------------------------- |
| `npm start`             | Expo, aplicação real                                  |
| `npm run proto`         | protótipo de UI em quarentena — ver `proto/README.md` |
| `npm run lint`          | ESLint, inclui as proibições permanentes              |
| `npm run typecheck`     | TypeScript estrito                                    |
| `npm test`              | Vitest, lógica pura                                   |
| `npm run db:reset`      | recria a base do zero, com seed determinista          |
| `npm run db:test`       | pgTAP, incluindo os testes de ataque à RLS            |
| `npm run check:secrets` | exporta o bundle e procura segredos lá dentro         |

## Onde está o quê

```
app/         ecrãs (mínimos — os reais nascem na Fase 5)
src/theme/   tokens; nenhum valor de estilo pode viver fora daqui
src/i18n/    pt-PT e en; nenhuma string literal pode viver fora daqui
supabase/    migrações, seed e testes pgTAP
proto/       protótipo de UI em quarentena, não é código do produto
docs/adr/    decisões de arquitectura
docs/        plano de fases, esquema, bateria de ataque, ambientes
```

## Como se trabalha aqui

Fases numeradas, em `.claude/PLAN.md`. Nenhuma avança sem a anterior testada e
sem veredicto positivo do `rls-adversary`, que ataca a base de dados a partir
de fora e tem poder de veto.

As três primeiras regras de produto são políticas RLS em Postgres. Nunca lógica
de cliente. Um ecrã que esconda uma nota que a base devolveria não é uma nota
cega — é um ecrã bonito por cima de uma fuga.
