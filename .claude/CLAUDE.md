# Nota

App social onde amigos partilham notas de filmes, séries e episódios.

## Regras de produto — inegociáveis

1. **Nota cega.** Ninguém vê notas de terceiros para um título sem ter dado a sua.
2. **Visibilidade.** Perfis públicos ou privados, privado por omissão. Seguir é unidireccional; perfis privados geram pedido pendente.
3. **Círculo.** Subconjunto mútuo dos seguidores, máximo 30. Notificações de discordância, taste match, respostas e notas de episódio são exclusivos do Círculo.
4. **A nota nunca é escrita pelo utilizador.** É derivada da posição num ranking construído por comparação.

As regras 1 a 3 são políticas RLS em Postgres. Nunca lógica de cliente.

## Stack

Expo (React Native) · TypeScript estrito · Expo Router · Supabase (Postgres, Auth, RLS, Realtime) · Edge Functions em Deno · TanStack Query · Zustand · Vitest · pgTAP · TMDB

## Fases

1. Esquema + RLS + testes pgTAP de ataque
2. TMDB com cache no servidor
3. Motor de ranking comparativo
4. Social: seguir, Círculo, bloquear, denunciar, moderar
5. Feed + reveal + reacções e respostas
6. Notificações de discordância + resumo semanal
7. Cartões de partilha + import de CSV do Letterboxd

Não avançar sem a fase anterior testada e sem veredicto positivo do `rls-adversary`.

## Proibições permanentes

- Chamadas ao TMDB a partir do cliente
- Segredos no bundle
- Contagens públicas de seguidores
- Scroll infinito no feed
- Strings literais em componentes (i18n pt-PT + en desde o início)
- Estilos com valores literais fora dos tokens
