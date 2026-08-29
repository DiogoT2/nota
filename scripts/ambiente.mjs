/**
 * Lê o `.env` para os scripts, sem dependências.
 *
 * Existe porque os scripts tinham as chaves do Supabase local escritas no
 * código como valor por omissão. Funcionavam — até o `supabase start` passar a
 * emitir chaves com outro formato, e aí passariam a falhar por uma razão que
 * não tem nada que ver com o que estão a testar. Uma credencial em código é uma
 * bomba-relógio mesmo quando é pública.
 */
import { existsSync, readFileSync } from 'node:fs';

export function carregar(caminho = '.env') {
  const env = { ...process.env };
  if (!existsSync(caminho)) return env;
  for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(linha);
    // O ambiente ganha ao ficheiro: no CI as variáveis vêm dos segredos.
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
  }
  return env;
}

export function exigir(env, nome) {
  const v = env[nome];
  if (!v) {
    process.stderr.write(
      `${nome} não está definida. Corre \`npm run db:start\` e preenche o .env\n` +
        'a partir do .env.example — ver npm run check:env.\n',
    );
    process.exit(1);
  }
  return v;
}
