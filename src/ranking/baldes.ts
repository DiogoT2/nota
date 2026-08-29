/**
 * F3-1 · Os três baldes e os seus intervalos.
 *
 * O balde é a única coisa que a pessoa escolhe directamente. Tudo o resto — a
 * posição, e portanto a nota — sai de comparações. Regra 4 do produto.
 */

export const BALDES = ['nah', 'gostei', 'adorei'] as const;
export type Balde = (typeof BALDES)[number];

export type Intervalo = { readonly base: number; readonly topo: number };

/**
 * Os intervalos do PLAN.md. Não se sobrepõem, e o buraco de 0.1 entre eles é
 * deliberado: 4.9 e 5.0 são notas de baldes diferentes, e nenhuma nota derivada
 * pode cair entre as duas.
 */
export const INTERVALO: Readonly<Record<Balde, Intervalo>> = {
  nah: { base: 0.0, topo: 4.9 },
  gostei: { base: 5.0, topo: 7.9 },
  adorei: { base: 8.0, topo: 10.0 },
};

/** A partir de quantos títulos um balde se considera cheio. Ver D1. */
export const BALDE_CHEIO = 5;

export function ordem(balde: Balde): number {
  return BALDES.indexOf(balde);
}

/** Um balde é melhor do que outro? Usado ao mudar de balde numa reavaliação. */
export function melhorQue(a: Balde, b: Balde): boolean {
  return ordem(a) > ordem(b);
}

export function eBalde(v: unknown): v is Balde {
  return typeof v === 'string' && (BALDES as readonly string[]).includes(v);
}
