# Equipa de agentes — Nota

Agentes para Claude Code do projeto "Nota" (app social de notas de filmes, séries e episódios).

## Instalação

Copia a pasta `.claude` para a raiz do teu repositório:

```
o-teu-projeto/
├── .claude/
│   ├── agents/
│   └── CLAUDE.md
└── ...
```

Depois abre o Claude Code na raiz e confirma com `/agents`.

Para os teres disponíveis em todos os projetos, copia antes para `~/.claude/agents/`.

## Agentes

| Agente                   | Quando usar                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- |
| `tech-lead`              | Início de cada fase, decisões de arquitetura, fecho de fase                         |
| `db-architect`           | Qualquer alteração de esquema, migrações, RLS. Dono único de `supabase/migrations/` |
| `rls-adversary`          | Antes de fechar qualquer fase. Tem poder de veto                                    |
| `tmdb-integrator`        | Tudo o que toque em metadados do TMDB                                               |
| `ranking-engineer`       | Comparações, derivação de nota, taste match                                         |
| `mobile-engineer`        | Ecrãs, navegação, estado, offline                                                   |
| `design-system-keeper`   | Tokens, componentes, revisão de estilos                                             |
| `notifications-engineer` | Push, fan-out, resumo semanal                                                       |
| `trust-safety-engineer`  | Bloquear, denunciar, moderar                                                        |
| `qa`                     | Fluxos completos multi-utilizador                                                   |

## Ordem de trabalho

Nenhuma UI antes de o `db-architect` fechar o esquema e o `rls-adversary` passar.

## Aplicação

Ecrãs implementados a partir da direcção **1a "Sala Escura"** do Claude Design
(`Nota.dc.html`, projecto `dcf70d0e`).

```
npm install
npm start        # Expo
npm run typecheck
npm test         # lógica pura (Vitest)
```

| Rota                      | Ecrã do design                                      |
| ------------------------- | --------------------------------------------------- |
| `/`                       | `2a` Feed — só o Círculo, cronológico, com fim      |
| `/titulo/[id]`            | `2b` Detalhe do título, notas por distância à minha |
| `/avaliar/balde`          | `2c` Avaliar, passo 1 — o balde                     |
| `/avaliar/comparar`       | `2d` Avaliar, passo 2 — comparação, 5 rondas        |
| `/serie/[id]`             | `2e` Detalhe da série, episódio a episódio          |
| `/perfil/[handle]?visto=` | `2f` Perfil visto por estranho / seguidor / Círculo |
| `/ranking`                | `2g` Ranking pessoal, arrastável                    |
| `/partilhar/[id]`         | `2h` Cartão para Stories, 1080×1920                 |

`src/theme/` é a única fonte de valores visuais e `src/i18n/` a única fonte de
texto. `src/data/fixtures.ts` é temporário: desaparece quando o esquema e as
políticas RLS fecharem.
