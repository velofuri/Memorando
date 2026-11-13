import type { Difficulty, Layout, Shape } from './types';

export const SHAPES: Shape[] = ['circulo', 'quadrado', 'triangulo', 'estrela', 'losango', 'cruz'];
export const LAYOUTS: Layout[] = ['centro', 'cantos', 'linha', 'coluna'];
export const COUNTS = [1, 2, 3, 4] as const;

export const SHAPE_COLOR: Record<Shape, string> = {
  circulo: '#e03131',
  quadrado: '#1971c2',
  triangulo: '#2f9e44',
  estrela: '#f08c00',
  losango: '#9c36b5',
  cruz: '#0c8599',
};

export interface CardSpec {
  shape: Shape;
  count: number;
  layout: Layout;
}

export const cardId = (c: CardSpec) => `${c.shape}.${c.count}.${c.layout}`;

export function parseCard(id: string): CardSpec {
  const [shape, count, layout] = id.split('.');
  return { shape: shape as Shape, count: Number(count), layout: layout as Layout };
}

/** 6 formas × 4 quantidades × 4 posições = 96 cartões. */
export const ALL_CARDS: string[] = SHAPES.flatMap((shape) =>
  COUNTS.flatMap((count) => LAYOUTS.map((layout) => cardId({ shape, count, layout }))),
);

/** Quantos atributos (forma, quantidade, posição) diferem entre dois cartões: 0 a 3. */
export function diff(a: string, b: string): number {
  const x = parseCard(a);
  const y = parseCard(b);
  return Number(x.shape !== y.shape) + Number(x.count !== y.count) + Number(x.layout !== y.layout);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Embaralha garantindo que a ordem mude (quando possível). */
export function reshuffle<T>(arr: readonly T[]): T[] {
  if (arr.length < 2) return [...arr];
  for (let i = 0; i < 20; i++) {
    const s = shuffle(arr);
    if (s.some((v, k) => v !== arr[k])) return s;
  }
  return shuffle(arr);
}

/**
 * Escolhe k cartões-alvo. Fácil/médio: alvos diferem em pelo menos 2 atributos entre si.
 * Difícil: basta serem diferentes (podem diferir em 1 atributo só).
 */
export function pickTargets(k: number, difficulty: Difficulty): string[] {
  const minDiff = difficulty === 'dificil' ? 1 : 2;
  const chosen: string[] = [];
  for (const c of shuffle(ALL_CARDS)) {
    if (chosen.length >= k) break;
    if (chosen.every((t) => diff(c, t) >= minDiff)) chosen.push(c);
  }
  for (const c of shuffle(ALL_CARDS)) {
    if (chosen.length >= k) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen;
}

/**
 * Distratores para o reconhecimento. "Próximos" diferem de algum alvo em só 1 atributo.
 * Fácil: nenhum próximo. Médio: metade. Difícil: todos.
 */
export function pickDistractors(targets: string[], k: number, difficulty: Difficulty): string[] {
  const pool = shuffle(ALL_CARDS.filter((c) => !targets.includes(c)));
  const nNear = difficulty === 'dificil' ? k : difficulty === 'medio' ? Math.ceil(k / 2) : 0;
  const chosen: string[] = [];

  // Distratores próximos, espalhados entre alvos diferentes.
  while (chosen.length < nNear) {
    let added = false;
    for (const t of shuffle(targets)) {
      if (chosen.length >= nNear) break;
      const c = pool.find((p) => !chosen.includes(p) && diff(p, t) === 1);
      if (c) {
        chosen.push(c);
        added = true;
      }
    }
    if (!added) break;
  }
  // Distratores distantes (diferem de todos os alvos em 2+ atributos).
  for (const c of pool) {
    if (chosen.length >= k) break;
    if (!chosen.includes(c) && targets.every((t) => diff(c, t) >= 2)) chosen.push(c);
  }
  for (const c of pool) {
    if (chosen.length >= k) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  return chosen;
}

export function nearest(card: string, targets: string[]): { id: string; d: number } {
  let best = { id: targets[0], d: 4 };
  for (const t of targets) {
    const d = diff(card, t);
    if (d < best.d) best = { id: t, d };
  }
  return best;
}

const SHAPE_NAME: Record<Shape, [string, string]> = {
  circulo: ['círculo', 'círculos'],
  quadrado: ['quadrado', 'quadrados'],
  triangulo: ['triângulo', 'triângulos'],
  estrela: ['estrela', 'estrelas'],
  losango: ['losango', 'losangos'],
  cruz: ['cruz', 'cruzes'],
};
const LAYOUT_NAME: Record<Layout, string> = {
  centro: 'no centro',
  cantos: 'nos cantos',
  linha: 'em linha embaixo',
  coluna: 'em coluna à esquerda',
};

export function describeCard(id: string): string {
  const c = parseCard(id);
  const [s, p] = SHAPE_NAME[c.shape];
  return `${c.count} ${c.count === 1 ? s : p} ${LAYOUT_NAME[c.layout]}`;
}
