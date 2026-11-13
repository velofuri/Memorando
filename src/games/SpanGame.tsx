import { useEffect, useRef, useState } from 'react';
import { CardGrid, type CardState } from '../components/CardGrid';
import { pickTargets, shuffle } from '../lib/cards';
import type { Profile, SpanTrial } from '../lib/types';
import { FeedbackBadge, Instruction, Prompt, Transition, useAfter, type GameResult } from './common';

type Phase = 'intro' | 'watch' | 'repeat' | 'feedback' | 'between';

const ON_MS = 900;
const OFF_MS = 350;
const START_LENGTH = 2;

interface Props {
  profile: Profile;
  training: boolean;
  onFinish: (r: GameResult) => void;
}

const newSequence = (n: number, len: number) => shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, len);

/**
 * Modo sequência (estilo Corsi): cartões piscam um a um e a criança repete a ordem.
 * Duas tentativas por tamanho; avança se acertar ao menos uma; para quando errar as duas.
 */
export function SpanGame({ profile, training, onFinish }: Props) {
  const k = profile.cardCount;
  const [grid] = useState(() => pickTargets(k, profile.difficulty));
  const [phase, setPhase] = useState<Phase>('intro');
  const [length, setLength] = useState(START_LENGTH);
  const [attempt, setAttempt] = useState(0);
  const [sequence, setSequence] = useState<number[]>(() => newSequence(k, START_LENGTH));
  const [lit, setLit] = useState(-1);
  const [response, setResponse] = useState<number[]>([]);
  const responseRef = useRef<number[]>([]);
  const tapTimes = useRef<number[]>([]);
  const [lastOk, setLastOk] = useState(false);
  const lengthResults = useRef<boolean[]>([]);
  const trials = useRef<SpanTrial[]>([]);
  const t0 = useRef(0);

  // Animação da sequência.
  useEffect(() => {
    if (phase !== 'watch') return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    sequence.forEach((idx, i) => {
      const start = 500 + i * (ON_MS + OFF_MS);
      timers.push(setTimeout(() => setLit(idx), start));
      timers.push(setTimeout(() => setLit(-1), start + ON_MS));
    });
    timers.push(
      setTimeout(() => {
        t0.current = performance.now();
        responseRef.current = [];
        tapTimes.current = [];
        setResponse([]);
        setPhase('repeat');
      }, 500 + sequence.length * (ON_MS + OFF_MS)),
    );
    return () => timers.forEach(clearTimeout);
  }, [phase, sequence]);

  const advance = () => {
    const results = lengthResults.current;
    if (attempt === 0) {
      setAttempt(1);
      setSequence(newSequence(k, length));
    } else if (results.some(Boolean) && length < k) {
      lengthResults.current = [];
      setAttempt(0);
      setLength(length + 1);
      setSequence(newSequence(k, length + 1));
    } else {
      onFinish({ cards: grid, distractors: [], trials: trials.current });
      return;
    }
    setPhase('between');
  };

  const tap = (i: number) => {
    // Ref em vez do estado: toques rápidos seguidos não podem se perder.
    if (responseRef.current.length >= sequence.length) return;
    const r = [...responseRef.current, i];
    responseRef.current = r;
    tapTimes.current.push(Math.round(performance.now() - t0.current));
    setResponse(r);
    setLit(i);
    setTimeout(() => setLit((l) => (l === i ? -1 : l)), 250);
    if (r.length < sequence.length) return;
    const correct = r.every((v, j) => v === sequence[j]);
    trials.current.push({
      kind: 'span',
      length: sequence.length,
      sequence,
      response: r,
      correct,
      durationMs: tapTimes.current[tapTimes.current.length - 1],
      tapMs: [...tapTimes.current],
    });
    lengthResults.current.push(correct);
    setLastOk(correct);
    if (training) setPhase('feedback');
    else advance();
  };

  const states: CardState[] = grid.map((_, i) => (i === lit ? 'lit' : ''));

  switch (phase) {
    case 'intro':
      return (
        <Instruction
          icon="✨"
          text="Os cartões vão piscar um de cada vez. Depois, toque neles na mesma ordem!"
          onStart={() => setPhase('watch')}
        />
      );
    case 'between':
      return <Transition onNext={() => setPhase('watch')} text="Muito bem! Preparado para a próxima?" />;
    case 'watch':
      return (
        <div className="play">
          <Prompt icon="👀" text="Observe a ordem" />
          <CardGrid cards={grid} colors={profile.colors} states={states} />
        </div>
      );
    case 'repeat':
      return (
        <div className="play">
          <Prompt icon="👆" text={`Agora é sua vez! (${response.length}/${sequence.length})`} />
          <CardGrid cards={grid} colors={profile.colors} states={states} onTap={tap} />
        </div>
      );
    case 'feedback':
      return <SpanFeedback ok={lastOk} onDone={advance} />;
  }
}

function SpanFeedback({ ok, onDone }: { ok: boolean; onDone: () => void }) {
  useAfter(1500, onDone);
  return (
    <div className="center-screen">
      <FeedbackBadge ok={ok} />
    </div>
  );
}
