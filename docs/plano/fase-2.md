# Fase 2 — TMDB com cache no servidor

Fonte das caixas: `.claude/PLAN.md`. Aceitação: **zero chamadas ao TMDB a partir
do cliente**, e chave ausente do bundle, verificado por `npm run check:secrets`.

A proibição não é uma preferência de arquitectura. Uma chave do TMDB num bundle
é uma chave pública: qualquer pessoa desempacota o IPA e usa a nossa quota. E o
TMDB atribui a quota à aplicação, não ao utilizador — o abuso é nosso.

---

## Três decisões que fixam o resto

### D1 · A pesquisa não escreve em `titles`

`search` devolve resultados normalizados e **não** grava nada. Só `title`
escreve, e só quando alguém abre um título de facto.

Porquê: escrever na pesquisa enche a tabela de títulos que ninguém vai avaliar —
vinte linhas por pesquisa, a maioria vista de relance. Pior, transforma cada
tecla numa escrita.

Consequência para o cliente: um resultado de pesquisa é identificado por
`(tmdb_id, kind)` e não pelo nosso `uuid`, que ainda não existe. Avaliar um
título chama `title` primeiro; é essa chamada que o materializa e devolve o
`uuid` com que `buckets` e `rank_positions` trabalham.

### D2 · Núcleo puro, casca fina

A lógica — normalização, fallback de língua, TTL, backoff, deduplicação — vive
em `supabase/functions/_shared/`, em TypeScript sem uma única API do Deno. Os
handlers em `search/` e `title/` são casca: leem o ambiente, chamam o núcleo,
serializam a resposta.

Porquê: a caixa «testes com respostas gravadas, nenhuma chamada real no CI»
resolve-se sozinha. O núcleo recebe o `fetch` por parâmetro, portanto um teste
passa-lhe uma função que devolve JSON gravado. O CI corre isto em Vitest, que já
existe, sem instalar Deno e sem rede.

O que fica por testar assim: o handler propriamente dito. É deliberado — se o
handler tiver lógica suficiente para precisar de teste, a lógica está no sítio
errado.

### D3 · Token v4 em cabeçalho, não chave v3 na query string

Uma chave numa URL fica no log de todos os proxies e servidores por onde a
chamada passa. Um `Authorization: Bearer` não. As duas credenciais funcionam; o
custo de escolher a segura é zero.

---

## Tarefas

### F2-1 · Núcleo: tipos e normalização

Artefacto: `_shared/tmdb.ts`.

Um filme e uma série chegam do TMDB com formas diferentes — `title` vs `name`,
`release_date` vs `first_air_date`. O resto da app não tem de saber disso.

Critério: um tipo único `Resultado` cobre filme e série; um teste com respostas
gravadas de ambos produz o mesmo formato. Só `poster_path` é guardado, nunca uma
URL — proibição permanente.

### F2-2 · Fallback de língua

Artefacto: `_shared/lingua.ts`.

Critério: pedido em `pt-PT`; se `title` ou `overview` vierem vazios, uma segunda
chamada em `en-US` preenche **apenas os campos vazios**. Um título com sinopse
em português e nome original em inglês não é sobreposto. Testado com uma
resposta gravada de sinopse vazia, que é o caso comum em filmes menos conhecidos.

### F2-3 · TTL diferenciado

Artefacto: `_shared/ttl.ts`.

Um filme de 1999 não muda. Uma série em emissão ganha episódios todas as semanas.

| o que                        | TTL      |
| ---------------------------- | -------- |
| filme com mais de um ano     | 90 dias  |
| filme recente ou por estrear | 7 dias   |
| série terminada ou cancelada | 30 dias  |
| série em emissão             | 24 horas |

Critério: função pura, tabela de casos em teste. O `status` do TMDB
(`Ended`, `Canceled`, `Returning Series`) é a entrada, não uma adivinhação a
partir da data.

### F2-4 · Backoff e deduplicação

Artefactos: `_shared/backoff.ts`, `_shared/dedup.ts`.

Critério do backoff: um 429 com `Retry-After` respeita o cabeçalho; sem ele,
espera exponencial com jitter. **O jitter não é cosmético** — sem ele, N
pedidos que falham ao mesmo tempo voltam a falhar ao mesmo tempo, para sempre.
Testado com um relógio falso, não com esperas reais.

Critério da deduplicação: dois pedidos simultâneos ao mesmo recurso fazem uma
só chamada ao TMDB. A memória é por isolate, o que não cobre várias instâncias —
mas o cache em Postgres cobre, e é lá que está a defesa real.

### F2-5 · Erros tipados

Artefacto: `_shared/erros.ts`.

Critério: nenhum corpo de erro do TMDB chega ao cliente. O cliente recebe um
código nosso de uma lista fechada. Um 401 do TMDB (chave errada) e um 404
(título inexistente) são coisas diferentes para nós e ambas opacas para quem
chama — um erro que cita o upstream diz ao atacante o que está por baixo.

### F2-6 · Edge Function `search`

Artefacto: `supabase/functions/search/index.ts`.

Critério: exige JWT de utilizador autenticado — a função não é uma porta aberta
para a nossa quota. Filmes e séries numa lista só. Não escreve (D1).

### F2-7 · Edge Function `title`

Artefacto: `supabase/functions/title/index.ts`.

Critério: filme devolve detalhe; série devolve temporadas e episódios completos,
**incluindo a temporada 0 dos especiais**, que é uma temporada legítima e não um
caso de erro. Faz upsert em `titles`/`seasons`/`episodes` com `service_role`, e
devolve o `uuid` nosso. Respeita o TTL: dentro do prazo não chama o TMDB.

### F2-8 · Atribuição do TMDB

Artefactos: componente, strings em `pt-PT` e `en`, logo nos assets.

Não estava no `PLAN.md`. É exigência dos termos de uso e requisito de aprovação
nas lojas: o logo e a frase de que o produto usa a API mas não é endossado nem
certificado pelo TMDB.

---

## Ordem

```
F2-1 ─┬─ F2-2 ─┐
      ├─ F2-3 ─┼─ F2-6 (search)
      ├─ F2-4 ─┤
      └─ F2-5 ─┴─ F2-7 (title)

F2-8 é independente e pode ser feita a qualquer momento.
```

## O que esta fase não faz

- **Não impõe rate limiting por utilizador.** O backoff protege-nos do TMDB;
  não protege a nossa quota de um utilizador nosso em ciclo. Com dez pessoas não
  é problema. Fica registado para a fase de lançamento.
- **Não trata imagens.** Guardamos `poster_path`; compor a URL e servir a imagem
  é do cliente, com uma lista fechada de tamanhos.
- **Não sincroniza.** Um título em cache com TTL expirado revalida quando alguém
  o abre. Não há trabalho de fundo a percorrer a tabela.
