# proto/ — protótipo de UI em quarentena

Ver `docs/adr/0001-stack.md`, opção F5.

Estes ecrãs foram escritos antes das Fases 0 a 2 e mostram aparência de Fase 5
sem esquema, sem RLS e sem TMDB por baixo. Não são código do produto:

- não entram no `tsconfig.json` da raiz, no Vitest nem no ESLint
- não são importados por nada em `app/` ou `src/`
- os dados vêm de `proto/src/data/fixtures.ts`, não de uma base de dados

Servem como **referência visual** para a Fase 5. O `mobile-engineer` parte dos
requisitos, não daqui.

Correr: `npm run proto`.

Apagar quando a Fase 5 fechar: `rm -rf proto/`, tirar a linha `proto` do
`tsconfig.json` e do `eslint.config.js`, e o script `proto` do `package.json`.
