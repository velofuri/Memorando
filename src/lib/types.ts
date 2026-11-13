export type Shape = 'circulo' | 'quadrado' | 'triangulo' | 'estrela' | 'losango' | 'cruz';
export type Layout = 'centro' | 'cantos' | 'linha' | 'coluna';
export type Difficulty = 'facil' | 'medio' | 'dificil';
export type Mode = 'escolhida' | 'conjunto' | 'desenho' | 'span';

export interface Profile {
  id?: number;
  name: string;
  cardCount: number;
  exposureMs: number;
  intervalMs: number;
  difficulty: Difficulty;
  colors: boolean;
  trials: number;
  delayedRecall: boolean;
}

export interface Patient {
  id?: number;
  code: string;
  birthDate: string; // yyyy-mm-dd
  nickname?: string;
  createdAt: number;
}

/** Uma resposta (toque) da criança. */
export interface Tap {
  cardId: string;
  correct: boolean;
  rtMs: number;
  /** Para erros: alvo mais parecido com o cartão tocado e quantos atributos diferem. */
  nearestTarget?: string;
  nearestDiff?: number;
}

export interface ChosenTrial {
  kind: 'escolhida';
  cards: string[];
  chosen: string;
  chooseRtMs: number;
  response: Tap;
}

export interface SetTrial {
  kind: 'conjunto';
  delayed: boolean;
  options: string[];
  selected: Tap[];
  hits: number;
  falseAlarms: number;
  misses: number;
  durationMs: number;
}

export interface DrawTrial {
  kind: 'desenho';
  delayed: boolean;
  recalled: string[];
  intrusions: number;
}

export interface SpanTrial {
  kind: 'span';
  length: number;
  sequence: number[];
  response: number[];
  correct: boolean;
  durationMs: number;
}

export type Trial = ChosenTrial | SetTrial | DrawTrial | SpanTrial;

export interface Session {
  id?: number;
  patientId: number;
  mode: Mode;
  profile: Profile; // cópia da configuração usada
  training: boolean;
  startedAt: number;
  finishedAt: number;
  ageMonths: number;
  /** conjunto/desenho: cartões-alvo; span: cartões da grade. */
  cards: string[];
  /** conjunto: distratores usados no reconhecimento. */
  distractors: string[];
  trials: Trial[];
  notes: string;
  delayedPending: boolean;
}

export const MODE_LABEL: Record<Mode, string> = {
  escolhida: 'Reconhecimento da escolhida',
  conjunto: 'Memória de conjunto (reconhecimento)',
  desenho: 'Memória de conjunto (desenho)',
  span: 'Sequência (span)',
};

export const MODE_SHORT: Record<Mode, string> = {
  escolhida: 'Escolhida',
  conjunto: 'Conjunto',
  desenho: 'Desenho',
  span: 'Sequência',
};

export const MODE_HELP: Record<Mode, string> = {
  escolhida: 'A criança escolhe um cartão; após uma pausa os cartões são embaralhados e ela deve encontrá-lo.',
  conjunto: 'Os cartões aparecem por alguns segundos; depois a criança marca, entre vistos e novos, os que viu. Repete em vários ensaios (curva de aprendizagem).',
  desenho: 'Os cartões aparecem por alguns segundos; a criança desenha no papel o que lembra e o profissional marca na tela.',
  span: 'Os cartões piscam um a um; a criança toca na mesma ordem. A sequência cresce até ela errar.',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
};
