import { describe, expect, it } from 'vitest';
import { ptPT } from './locales/pt-PT';
import { en } from './locales/en';

/** Caminhos com ponto de todas as folhas de um dicionário. */
function keys(node: unknown, prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

/** Nomes das substituições `{{assim}}` dentro de uma string. */
function slots(template: string): string[] {
  return [...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!).sort();
}

function flatten(node: unknown, prefix = ''): Record<string, string> {
  if (typeof node === 'string') return { [prefix]: node };
  if (typeof node !== 'object' || node === null) return {};
  return Object.assign(
    {},
    ...Object.entries(node).map(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k)),
  );
}

describe('dicionários', () => {
  it('en tem exactamente as chaves de pt-PT', () => {
    expect(keys(en).sort()).toEqual(keys(ptPT).sort());
  });

  it('as substituições coincidem chave a chave', () => {
    const origem = flatten(ptPT);
    const traducao = flatten(en);
    for (const [key, template] of Object.entries(origem)) {
      expect({ key, slots: slots(traducao[key] ?? '') }).toEqual({
        key,
        slots: slots(template),
      });
    }
  });

  it('nenhuma tradução ficou por fazer', () => {
    for (const [key, texto] of Object.entries(flatten(en))) {
      expect(texto.trim(), key).not.toBe('');
    }
  });
});
