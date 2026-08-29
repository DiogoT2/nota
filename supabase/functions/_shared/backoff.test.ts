import { describe, expect, it } from 'vitest';
import {
  comBackoff,
  espera,
  retryAfter,
  type Politica,
  type Relogio,
} from './backoff.ts';
import { ErroTmdb } from './erros.ts';

const politica: Politica = { tentativas: 3, baseMs: 400, tectoMs: 8000 };

/** Relógio falso: regista as esperas em vez de as cumprir. */
function relogioFalso(acasos: number[] = []): Relogio & { esperas: number[] } {
  const esperas: number[] = [];
  let i = 0;
  return {
    esperas,
    esperar: async (ms) => {
      esperas.push(ms);
    },
    acaso: () => acasos[i++ % Math.max(acasos.length, 1)] ?? 0.5,
  };
}

describe('espera exponencial', () => {
  it('duplica a cada tentativa, até ao tecto', () => {
    // Com acaso = 1 vê-se o tecto de cada tentativa sem o jitter a mascarar.
    expect(espera(0, politica, 1)).toBe(400);
    expect(espera(1, politica, 1)).toBe(800);
    expect(espera(2, politica, 1)).toBe(1600);
    expect(espera(9, politica, 1)).toBe(8000);
  });

  it('o jitter espalha os clientes em vez de os sincronizar', () => {
    // Este é o ponto todo. Dez clientes que falham no mesmo instante têm de
    // voltar em instantes diferentes; sem jitter voltariam todos juntos e o
    // pico que causou o 429 repetir-se-ia inteiro.
    const dez = Array.from({ length: 10 }, (_, i) => espera(2, politica, i / 10));
    expect(new Set(dez).size).toBeGreaterThan(5);
    for (const e of dez) expect(e).toBeLessThanOrEqual(1600);
  });
});

describe('retry-after', () => {
  it('lê segundos', () => {
    expect(retryAfter('30')).toBe(30_000);
    expect(retryAfter('0')).toBe(0);
  });

  it('lê uma data HTTP', () => {
    const agora = new Date('2026-08-29T12:00:00Z');
    expect(retryAfter('Sat, 29 Aug 2026 12:00:30 GMT', agora)).toBe(30_000);
  });

  it('uma data no passado não dá espera negativa', () => {
    const agora = new Date('2026-08-29T12:00:00Z');
    expect(retryAfter('Sat, 29 Aug 2026 11:59:00 GMT', agora)).toBe(0);
  });

  it('ausente ou ilegível é nulo', () => {
    expect(retryAfter(null)).toBeNull();
    expect(retryAfter('logo')).toBeNull();
  });
});

describe('comBackoff', () => {
  it('devolve à primeira quando corre bem', async () => {
    const r = relogioFalso();
    expect(await comBackoff(async () => 'ok', { politica, relogio: r })).toBe('ok');
    expect(r.esperas).toEqual([]);
  });

  it('repete um erro repetível e acaba por resultar', async () => {
    const r = relogioFalso([0.5]);
    let n = 0;
    const valor = await comBackoff(
      async () => {
        n += 1;
        if (n < 3) throw new ErroTmdb('indisponivel');
        return 'ok';
      },
      { politica, relogio: r },
    );
    expect(valor).toBe('ok');
    expect(n).toBe(3);
    expect(r.esperas).toHaveLength(2);
  });

  it('não repete um erro que repetir não resolve', async () => {
    const r = relogioFalso();
    let n = 0;
    // Repetir um 401 com a mesma credencial errada dá o mesmo 401 e gasta
    // quota; repetir um 404 não faz o título nascer.
    for (const codigo of ['credencial', 'nao_encontrado', 'pedido_invalido'] as const) {
      n = 0;
      await expect(
        comBackoff(
          async () => {
            n += 1;
            throw new ErroTmdb(codigo);
          },
          { politica, relogio: r },
        ),
      ).rejects.toThrow(ErroTmdb);
      expect(n).toBe(1);
    }
    expect(r.esperas).toEqual([]);
  });

  it('desiste ao fim das tentativas e propaga o último erro', async () => {
    const r = relogioFalso();
    let n = 0;
    await expect(
      comBackoff(
        async () => {
          n += 1;
          throw new ErroTmdb('indisponivel', `tentativa ${n}`);
        },
        { politica, relogio: r },
      ),
    ).rejects.toMatchObject({ codigo: 'indisponivel', interno: 'tentativa 3' });
    expect(n).toBe(3);
    // Espera-se entre tentativas, não depois da última: esperar no fim faria a
    // pessoa aguardar por uma resposta que já se sabe que não vem.
    expect(r.esperas).toHaveLength(2);
  });

  it('quando o servidor diz quando voltar, obedece', async () => {
    const r = relogioFalso([0.5]);
    let n = 0;
    await comBackoff(
      async () => {
        n += 1;
        if (n < 2) throw new ErroTmdb('indisponivel');
        return 'ok';
      },
      { politica, relogio: r, esperaSugerida: () => 12_345 },
    );
    expect(r.esperas).toEqual([12_345]);
  });
});
