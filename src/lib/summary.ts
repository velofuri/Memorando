import type { Session } from './types';
import { mean } from './util';

export interface Summary {
  /** Pontuação principal (comparável entre sessões do mesmo modo e perfil). */
  score: number;
  max: number;
  scoreText: string;
  /** Curva por ensaio (aprendizagem). Vazia quando não se aplica. */
  curve: number[];
  curveMax: number;
  delayed?: number;
  meanRtMs?: number;
  details: string[];
  /** Modo sequência: uma linha por tentativa. */
  attempts?: SpanAttempt[];
}

export interface SpanAttempt {
  n: number;
  length: number;
  correct: boolean;
  /** Posições na grade, começando em 1 (1 = canto superior esquerdo). */
  sequence: number[];
  response: number[];
  /** Posição (1, 2, 3…) do primeiro toque errado na resposta. */
  firstError?: number;
  durationMs: number;
  perTapMs: number;
  /** Tempo até o primeiro toque (só em sessões novas). */
  firstTapMs?: number;
}

export const secs = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

export function summarize(s: Session): Summary {
  const k = s.profile.cardCount;
  switch (s.mode) {
    case 'escolhida': {
      const trials = s.trials.filter((t) => t.kind === 'escolhida');
      const ok = trials.filter((t) => t.response.correct).length;
      const rt = mean(trials.map((t) => t.response.rtMs));
      const chooseRt = mean(trials.map((t) => t.chooseRtMs));
      return {
        score: ok,
        max: trials.length,
        scoreText: `${ok}/${trials.length} acertos`,
        curve: trials.map((t) => (t.response.correct ? 1 : 0)),
        curveMax: 1,
        meanRtMs: rt,
        details: [
          `Acertos: ${ok} de ${trials.length}`,
          rt !== undefined ? `Tempo médio para encontrar: ${(rt / 1000).toFixed(2)} s` : '',
          chooseRt !== undefined ? `Tempo médio para escolher: ${(chooseRt / 1000).toFixed(2)} s` : '',
        ].filter(Boolean),
      };
    }
    case 'conjunto': {
      const all = s.trials.filter((t) => t.kind === 'conjunto');
      const learn = all.filter((t) => !t.delayed);
      const del = all.find((t) => t.delayed);
      const last = learn[learn.length - 1];
      const fa = learn.reduce((a, t) => a + t.falseAlarms, 0);
      const faNear = learn.flatMap((t) => t.selected).filter((x) => !x.correct && x.nearestDiff === 1).length;
      const rt = mean(all.flatMap((t) => t.selected.map((x) => x.rtMs)));
      return {
        score: last?.hits ?? 0,
        max: k,
        scoreText: `${last?.hits ?? 0}/${k} no último ensaio`,
        curve: learn.map((t) => t.hits),
        curveMax: k,
        delayed: del?.hits,
        meanRtMs: rt,
        details: [
          `Acertos por ensaio: ${learn.map((t) => t.hits).join(' → ')}`,
          `Falsos positivos (total nos ensaios): ${fa}, sendo ${faNear} em cartões parecidos com um alvo (1 atributo diferente)`,
          del ? `Evocação tardia: ${del.hits}/${k} acertos, ${del.falseAlarms} falsos positivos` : '',
          rt !== undefined ? `Tempo médio por marcação: ${(rt / 1000).toFixed(2)} s` : '',
        ].filter(Boolean),
      };
    }
    case 'desenho': {
      const all = s.trials.filter((t) => t.kind === 'desenho');
      const learn = all.filter((t) => !t.delayed);
      const del = all.find((t) => t.delayed);
      const last = learn[learn.length - 1];
      const intr = learn.reduce((a, t) => a + t.intrusions, 0);
      return {
        score: last?.recalled.length ?? 0,
        max: k,
        scoreText: `${last?.recalled.length ?? 0}/${k} no último ensaio`,
        curve: learn.map((t) => t.recalled.length),
        curveMax: k,
        delayed: del?.recalled.length,
        details: [
          `Cartões desenhados por ensaio: ${learn.map((t) => t.recalled.length).join(' → ')}`,
          `Intrusões (desenhos que não estavam): ${intr}`,
          del ? `Evocação tardia: ${del.recalled.length}/${k}, ${del.intrusions} intrusões` : '',
        ].filter(Boolean),
      };
    }
    case 'span': {
      const trials = s.trials.filter((t) => t.kind === 'span');
      const span = Math.max(0, ...trials.filter((t) => t.correct).map((t) => t.length));
      const attempts: SpanAttempt[] = trials.map((t, i) => {
        const fe = t.response.findIndex((v, j) => v !== t.sequence[j]);
        return {
          n: i + 1,
          length: t.length,
          correct: t.correct,
          sequence: t.sequence.map((v) => v + 1),
          response: t.response.map((v) => v + 1),
          firstError: fe >= 0 ? fe + 1 : undefined,
          durationMs: t.durationMs,
          perTapMs: t.durationMs / t.length,
          firstTapMs: t.tapMs?.[0],
        };
      });
      const ok = attempts.filter((a) => a.correct).length;
      const last = attempts[attempts.length - 1];
      const stopped = !!last && attempts.filter((a) => a.length === last.length).every((a) => !a.correct);
      const perTap = mean(attempts.map((a) => a.perTapMs));
      const perAttempt = mean(attempts.map((a) => a.durationMs));
      const firstTap = mean(attempts.flatMap((a) => (a.firstTapMs !== undefined ? [a.firstTapMs] : [])));
      return {
        score: span,
        max: k,
        scoreText: `span ${span}`,
        curve: [],
        curveMax: k,
        meanRtMs: perTap,
        attempts,
        details: [
          `Span (maior sequência repetida corretamente): ${span} de ${k} cartões`,
          `Acertos: ${ok} de ${attempts.length} tentativas (2 tentativas por tamanho, começando com 2 cartões)`,
          stopped
            ? `Encerrado no tamanho ${last.length}: errou as duas tentativas desse tamanho`
            : `Completou todos os tamanhos possíveis (até ${k} cartões)`,
          perAttempt !== undefined ? `Tempo médio por tentativa: ${secs(perAttempt)} · por toque: ${secs(perTap!)}` : '',
          firstTap !== undefined ? `Tempo médio até o primeiro toque: ${secs(firstTap)}` : '',
        ].filter(Boolean),
      };
    }
  }
}

/** Chave para agrupar sessões comparáveis (evolução). */
export const groupKey = (s: Session) => `${s.mode}|${s.profile.name}`;
