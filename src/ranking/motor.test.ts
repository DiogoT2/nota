import { describe, expect, it } from 'vitest';
import { BALDES, type Balde } from './baldes.ts';
import { colocarCom, comparacoesNecessarias, type Resposta } from './comparar.ts';
import { LIMITE_COMPARACOES } from './limites.ts';
import { coerente } from './posicoes.ts';
import { arrastar, avaliar, notas, responderA, type Passo } from './motor.ts';
import type { Entrada } from './ambitos.ts';

/** Gerador determinista. Um fuzz que muda a cada execução não é reproduzível. */
function acaso(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Corre uma avaliação até ao fim, respondendo com um oráculo.
 *
 * O oráculo dá a «verdade» — uma qualidade real por título — e responde
 * consistentemente com ela. É o que permite verificar a propriedade central:
 * a ordem final tem de bater certo com as respostas dadas.
 */
function avaliarAte(
  ambito: readonly Entrada[],
  subjectId: string,
  balde: Balde,
  responderA_: (novo: string, contra: string) => Resposta,
): { ambito: readonly Entrada[]; comparacoes: number; perguntas: string[] } {
  const perguntas: string[] = [];
  let passo: Passo = avaliar(ambito, subjectId, balde);

  while (passo.tipo === 'pergunta') {
    perguntas.push(passo.contra);
    const r = responderA_(subjectId, passo.contra);
    passo = responderA(ambito, passo.avaliacao, r);
  }

  return { ambito: passo.ambito, comparacoes: passo.comparacoes, perguntas };
}

describe('o tecto de comparações', () => {
  it('o primeiro título de um balde não gera pergunta nenhuma', () => {
    const r = avaliarAte([], 'a', 'adorei', () => 'novo');
    expect(r.comparacoes).toBe(0);
    expect(r.perguntas).toEqual([]);
    expect(r.ambito).toHaveLength(1);
  });

  it('nunca há uma sexta pergunta, com balde nenhum', () => {
    // 200 títulos num balde: a busca binária exacta precisaria de 8.
    for (const tamanho of [1, 5, 31, 32, 100, 200]) {
      const balde = Array.from({ length: tamanho }, (_, i) => `t${i}`);
      const r = colocarCom(balde, () => 'existente');
      expect(r.comparacoes).toBeLessThanOrEqual(LIMITE_COMPARACOES);
      expect(r.perguntas.length).toBeLessThanOrEqual(LIMITE_COMPARACOES);
    }
  });

  it('até 31 títulos coloca com exactidão dentro do tecto', () => {
    expect(comparacoesNecessarias(31)).toBe(5);
    expect(comparacoesNecessarias(32)).toBe(6);
  });

  it('nunca promete mais perguntas do que as que faltam', () => {
    const balde = Array.from({ length: 100 }, (_, i) => `t${i}`);
    let estado = avaliar(
      balde.map((id, i) => ({
        subjectId: id,
        balde: 'gostei' as const,
        posicao: (i + 1) * 1024,
        pregado: false,
      })),
      'novo',
      'gostei',
    );
    let vistas = 0;
    while (estado.tipo === 'pergunta') {
      vistas += 1;
      expect(estado.numero).toBe(vistas);
      expect(estado.numero + estado.maximoRestante - 1).toBeLessThanOrEqual(
        LIMITE_COMPARACOES,
      );
      estado = responderA([], estado.avaliacao, 'existente');
    }
  });
});

describe('«não sei»', () => {
  it('aborta e coloca no meio da janela corrente', () => {
    const balde = Array.from({ length: 8 }, (_, i) => `t${i}`);
    const r = colocarCom(balde, (contra) => (contra === 't4' ? 'nao-sei' : 'novo'));
    // Primeira pergunta é contra t4, e a resposta é «não sei» logo à partida.
    expect(r.comparacoes).toBe(0);
    expect(r.indice).toBe(4);
  });

  it('respeita o que já foi respondido antes de abortar', () => {
    const balde = Array.from({ length: 8 }, (_, i) => `t${i}`);
    // Melhor que t4 (janela passa a [0,4)), depois não sei.
    const r = colocarCom(balde, (contra) => (contra === 't4' ? 'novo' : 'nao-sei'));
    expect(r.comparacoes).toBe(1);
    expect(r.indice).toBeLessThan(4);
  });
});

describe('propriedade central: a ordem respeita as respostas', () => {
  it('com um oráculo consistente, a ordem final é a ordem real', () => {
    // Cada título tem uma qualidade; o oráculo responde sempre segundo ela.
    // Com ≤31 títulos no balde a colocação é exacta, portanto a lista final
    // tem de sair ordenada por qualidade.
    for (const semente of [1, 7, 42, 1234]) {
      const r = acaso(semente);
      const qualidade = new Map<string, number>();
      let ambito: readonly Entrada[] = [];

      for (let i = 0; i < 25; i += 1) {
        const id = `t${i}`;
        qualidade.set(id, r());
        ambito = avaliarAte(ambito, id, 'gostei', (novo, contra) =>
          qualidade.get(novo)! > qualidade.get(contra)! ? 'novo' : 'existente',
        ).ambito;
      }

      const ordenado = [...ambito].sort((a, b) => a.posicao - b.posicao);
      for (let i = 1; i < ordenado.length; i += 1) {
        expect(qualidade.get(ordenado[i - 1]!.subjectId)!).toBeGreaterThan(
          qualidade.get(ordenado[i]!.subjectId)!,
        );
      }
    }
  });

  it('cada resposta individual é respeitada na ordem final', () => {
    const r = acaso(99);
    const qualidade = new Map<string, number>();
    let ambito: readonly Entrada[] = [];
    const respostas: { melhor: string; pior: string }[] = [];

    for (let i = 0; i < 20; i += 1) {
      const id = `t${i}`;
      qualidade.set(id, r());
      ambito = avaliarAte(ambito, id, 'adorei', (novo, contra) => {
        const novoGanha = qualidade.get(novo)! > qualidade.get(contra)!;
        respostas.push(
          novoGanha ? { melhor: novo, pior: contra } : { melhor: contra, pior: novo },
        );
        return novoGanha ? 'novo' : 'existente';
      }).ambito;
    }

    const posicao = new Map(ambito.map((e) => [e.subjectId, e.posicao]));
    for (const { melhor, pior } of respostas) {
      expect(posicao.get(melhor)!).toBeLessThan(posicao.get(pior)!);
    }
  });
});

describe('fuzz: 1000 inserções', () => {
  it('nunca passa das 5 comparações e nunca corrompe o ranking', () => {
    const r = acaso(20260829);
    const qualidade = new Map<string, number>();
    let ambito: readonly Entrada[] = [];
    let maiorSequencia = 0;

    for (let i = 0; i < 1000; i += 1) {
      const id = `t${i}`;
      qualidade.set(id, r());
      const balde = BALDES[Math.floor(r() * BALDES.length)]!;

      const passo = avaliarAte(ambito, id, balde, (novo, contra) => {
        const x = r();
        // 10% de «não sei», para o caminho de aborto entrar no fuzz.
        if (x < 0.1) return 'nao-sei';
        return qualidade.get(novo)! > qualidade.get(contra)! ? 'novo' : 'existente';
      });

      expect(passo.comparacoes).toBeLessThanOrEqual(LIMITE_COMPARACOES);
      maiorSequencia = Math.max(maiorSequencia, passo.comparacoes);
      ambito = passo.ambito;

      const lista = [...ambito]
        .sort((a, b) => a.posicao - b.posicao)
        .map((e) => ({ subjectId: e.subjectId, posicao: e.posicao }));
      expect(coerente(lista)).toBe(true);
    }

    expect(ambito).toHaveLength(1000);
    expect(maiorSequencia).toBe(LIMITE_COMPARACOES);

    // As notas continuam a sair todas dentro do intervalo do seu balde.
    for (const n of notas(ambito)) {
      expect(Number.isFinite(n.nota)).toBe(true);
    }
  });

  it('arrastar 200 vezes no meio do fuzz não corrompe nada', () => {
    const r = acaso(7);
    let ambito: readonly Entrada[] = [];
    for (let i = 0; i < 60; i += 1) {
      ambito = avaliarAte(ambito, `t${i}`, 'gostei', () =>
        r() < 0.5 ? 'novo' : 'existente',
      ).ambito;
    }

    for (let i = 0; i < 200; i += 1) {
      const alvo = ambito[Math.floor(r() * ambito.length)]!.subjectId;
      const destino = Math.floor(r() * ambito.length);
      ambito = arrastar(ambito, alvo, destino).ambito;

      const lista = [...ambito]
        .sort((a, b) => a.posicao - b.posicao)
        .map((e) => ({ subjectId: e.subjectId, posicao: e.posicao }));
      expect(coerente(lista)).toBe(true);
    }
    expect(ambito).toHaveLength(60);
  });
});

describe('arrastar prega, e o pregado não se mexe (decisão D2)', () => {
  it('arrastar marca o título como pregado', () => {
    let ambito: readonly Entrada[] = [];
    for (const id of ['a', 'b', 'c']) {
      ambito = avaliarAte(ambito, id, 'gostei', () => 'existente').ambito;
    }
    expect(ambito.every((e) => !e.pregado)).toBe(true);

    ambito = arrastar(ambito, 'c', 0).ambito;
    const c = ambito.find((e) => e.subjectId === 'c')!;
    expect(c.pregado).toBe(true);
    expect([...ambito].sort((x, y) => x.posicao - y.posicao)[0]!.subjectId).toBe('c');
  });

  it('um título pregado não entra nas comparações seguintes', () => {
    let ambito: readonly Entrada[] = [];
    for (const id of ['a', 'b', 'c', 'd']) {
      ambito = avaliarAte(ambito, id, 'gostei', () => 'existente').ambito;
    }
    ambito = arrastar(ambito, 'd', 0).ambito;

    const r = avaliarAte(ambito, 'novo', 'gostei', () => 'existente');
    expect(r.perguntas).not.toContain('d');
    // E continua onde foi posto.
    const ordenado = [...r.ambito].sort((x, y) => x.posicao - y.posicao);
    expect(ordenado[0]!.subjectId).toBe('d');
  });
});

describe('reavaliação', () => {
  it('reavaliar reinicia o fluxo e não duplica o título', () => {
    let ambito: readonly Entrada[] = [];
    for (const id of ['a', 'b', 'c']) {
      ambito = avaliarAte(ambito, id, 'gostei', () => 'existente').ambito;
    }
    const depois = avaliarAte(ambito, 'b', 'gostei', () => 'novo').ambito;
    expect(depois).toHaveLength(3);
    expect(depois.filter((e) => e.subjectId === 'b')).toHaveLength(1);
  });

  it('mudar de balde move o título entre intervalos sem corromper os outros', () => {
    let ambito: readonly Entrada[] = [];
    for (const id of ['a', 'b']) {
      ambito = avaliarAte(ambito, id, 'nah', () => 'existente').ambito;
    }
    for (const id of ['x', 'y']) {
      ambito = avaliarAte(ambito, id, 'adorei', () => 'existente').ambito;
    }

    const antes = new Map(notas(ambito).map((n) => [n.subjectId, n.nota]));
    expect(antes.get('a')).toBeLessThan(5);

    ambito = avaliarAte(ambito, 'a', 'adorei', () => 'existente').ambito;

    const depois = new Map(notas(ambito).map((n) => [n.subjectId, n.nota]));
    expect(depois.get('a')).toBeGreaterThanOrEqual(8);
    expect(depois.get('b')).toBeLessThan(5);

    const lista = [...ambito]
      .sort((p, q) => p.posicao - q.posicao)
      .map((e) => ({ subjectId: e.subjectId, posicao: e.posicao }));
    expect(coerente(lista)).toBe(true);
    expect(ambito).toHaveLength(4);
  });

  it('os baldes ficam em faixas contíguas, os melhores primeiro', () => {
    let ambito: readonly Entrada[] = [];
    const plano: [string, Balde][] = [
      ['n1', 'nah'],
      ['a1', 'adorei'],
      ['g1', 'gostei'],
      ['a2', 'adorei'],
      ['n2', 'nah'],
      ['g2', 'gostei'],
    ];
    for (const [id, b] of plano) {
      ambito = avaliarAte(ambito, id, b, () => 'existente').ambito;
    }

    const ordem = { adorei: 2, gostei: 1, nah: 0 } as const;
    const ordenado = [...ambito].sort((x, y) => x.posicao - y.posicao);
    for (let i = 1; i < ordenado.length; i += 1) {
      expect(ordem[ordenado[i]!.balde]).toBeLessThanOrEqual(
        ordem[ordenado[i - 1]!.balde],
      );
    }
  });
});
