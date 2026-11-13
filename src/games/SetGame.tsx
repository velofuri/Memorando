import { useRef, useState } from 'react';
import { CardGrid, type CardState } from '../components/CardGrid';
import { nearest, pickDistractors, pickTargets, shuffle } from '../lib/cards';
import type { DrawTrial, Profile, SetTrial, Tap } from '../lib/types';
import { Blank, Exposure, Instruction, Prompt, Transition, type GameResult } from './common';

type Phase = 'intro' | 'expose' | 'blank' | 'respond' | 'draw' | 'mark' | 'feedback' | 'between';

interface Props {
  mode: 'conjunto' | 'desenho';
  profile: Profile;
  training: boolean;
  /** Evocação tardia: reaproveita os cartões da sessão original, sem nova exposição. */
  delayed?: { cards: string[]; distractors: string[] };
  onFinish: (r: GameResult) => void;
}

/** Modo 2: memória de um conjunto de cartões, com reconhecimento ou evocação por desenho. */
export function SetGame({ mode, profile, training, delayed, onFinish }: Props) {
  const k = profile.cardCount;
  const [targets] = useState(() => delayed?.cards ?? pickTargets(k, profile.difficulty));
  const [distractors] = useState(() =>
    delayed?.distractors ?? (mode === 'conjunto' ? pickDistractors(targets, k, profile.difficulty) : []),
  );
  const totalTrials = delayed ? 1 : profile.trials;

  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<Map<number, number>>(new Map()); // índice -> rt
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [intrusions, setIntrusions] = useState(0);
  const trials = useRef<(SetTrial | DrawTrial)[]>([]);
  const t0 = useRef(0);
  /** Evita gravar o mesmo ensaio duas vezes com toque duplo em "Pronto"/"Salvar". */
  const saved = useRef(false);

  const startResponse = () => {
    saved.current = false;
    if (mode === 'conjunto') {
      setOptions(shuffle([...targets, ...distractors]));
      setSelected(new Map());
      t0.current = performance.now();
      setPhase('respond');
    } else {
      setPhase('draw');
    }
  };

  const startTrial = () => (delayed ? startResponse() : setPhase('expose'));

  const next = () => {
    if (trialIdx + 1 >= totalTrials) {
      onFinish({ cards: targets, distractors, trials: trials.current });
      return;
    }
    setTrialIdx(trialIdx + 1);
    setPhase('between');
  };

  // Atualizações funcionais: toques rápidos seguidos não podem se sobrescrever.
  const toggle = (i: number) => {
    const rt = Math.round(performance.now() - t0.current);
    setSelected((prev) => {
      const m = new Map(prev);
      if (m.has(i)) m.delete(i);
      else m.set(i, rt);
      return m;
    });
  };

  const finishRecognition = () => {
    if (saved.current) return;
    saved.current = true;
    const sel: Tap[] = [...selected.entries()].map(([i, rt]) => {
      const id = options[i];
      const correct = targets.includes(id);
      const n = correct ? undefined : nearest(id, targets);
      return { cardId: id, correct, rtMs: rt, ...(n ? { nearestTarget: n.id, nearestDiff: n.d } : {}) };
    });
    const hits = sel.filter((s) => s.correct).length;
    trials.current.push({
      kind: 'conjunto',
      delayed: !!delayed,
      options,
      selected: sel,
      hits,
      falseAlarms: sel.length - hits,
      misses: targets.length - hits,
      durationMs: Math.round(performance.now() - t0.current),
    });
    if (training) setPhase('feedback');
    else next();
  };

  const finishMarking = () => {
    if (saved.current) return;
    saved.current = true;
    trials.current.push({
      kind: 'desenho',
      delayed: !!delayed,
      recalled: [...marked].map((i) => targets[i]),
      intrusions,
    });
    setMarked(new Set());
    setIntrusions(0);
    next();
  };

  switch (phase) {
    case 'intro':
      return delayed ? (
        <Instruction icon="🧠" text="Lembra dos cartões que você viu antes? Vamos ver!" onStart={startTrial} />
      ) : (
        <Instruction
          icon="👀"
          text={
            mode === 'conjunto'
              ? 'Olhe bem os cartões. Depois você vai encontrar os que viu!'
              : 'Olhe bem os cartões. Depois você vai desenhar os que lembrar!'
          }
          onStart={startTrial}
        />
      );
    case 'between':
      return <Transition onNext={startTrial} />;
    case 'expose':
      return <Exposure cards={targets} colors={profile.colors} ms={profile.exposureMs} onDone={() => setPhase('blank')} />;
    case 'blank':
      return <Blank ms={profile.intervalMs} onDone={startResponse} />;
    case 'respond':
      return (
        <div className="play">
          <Prompt icon="👆" text="Toque nos cartões que você viu" />
          <CardGrid
            cards={options}
            colors={profile.colors}
            states={options.map((_, i) => (selected.has(i) ? 'selected' : ''))}
            onTap={toggle}
          />
          <div className="play-footer">
            <button type="button" className="kid-btn" onClick={finishRecognition}>Pronto ✔</button>
          </div>
        </div>
      );
    case 'feedback': {
      const states: CardState[] = options.map((c, i) =>
        selected.has(i) ? (targets.includes(c) ? 'hit' : 'wrong') : targets.includes(c) ? 'missed' : '',
      );
      const hits = [...selected.keys()].filter((i) => targets.includes(options[i])).length;
      return (
        <div className="play">
          <Prompt icon="⭐" text={`Você encontrou ${hits} de ${targets.length}!`} />
          <CardGrid cards={options} colors={profile.colors} states={states} />
          <div className="play-footer">
            <button type="button" className="kid-btn" onClick={next}>Continuar</button>
          </div>
        </div>
      );
    }
    case 'draw':
      return (
        <Instruction
          icon="✏️"
          text="Agora desenhe no papel os cartões que você lembra."
          onStart={() => setPhase('mark')}
          label="Terminei de desenhar"
        />
      );
    case 'mark':
      return (
        <div className="play pro-mark">
          <div className="prompt pro">
            Profissional: toque nos cartões que a criança desenhou corretamente (ensaio {trialIdx + 1}
            {delayed ? ', evocação tardia' : ''}).
          </div>
          <CardGrid
            cards={targets}
            colors={profile.colors}
            states={targets.map((_, i) => (marked.has(i) ? 'selected' : ''))}
            onTap={(i) =>
              setMarked((prev) => {
                const s = new Set(prev);
                if (s.has(i)) s.delete(i);
                else s.add(i);
                return s;
              })
            }
          />
          <div className="play-footer">
            <div className="counter">
              <span>Intrusões (desenhos que não estavam):</span>
              <button type="button" onClick={() => setIntrusions(Math.max(0, intrusions - 1))}>−</button>
              <strong>{intrusions}</strong>
              <button type="button" onClick={() => setIntrusions(intrusions + 1)}>+</button>
            </div>
            <button type="button" className="kid-btn" onClick={finishMarking}>
              Salvar ensaio ({marked.size}/{targets.length})
            </button>
          </div>
        </div>
      );
  }
}
