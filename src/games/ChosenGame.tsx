import { useRef, useState } from 'react';
import { CardGrid, type CardState } from '../components/CardGrid';
import { diff, pickTargets, reshuffle } from '../lib/cards';
import type { ChosenTrial, Profile } from '../lib/types';
import { Blank, FeedbackBadge, Instruction, Prompt, Transition, useAfter, type GameResult } from './common';

type Phase = 'intro' | 'choose' | 'blank' | 'find' | 'feedback' | 'between';

interface Props {
  profile: Profile;
  training: boolean;
  onFinish: (r: GameResult) => void;
}

/** Modo 1: a criança escolhe um cartão e depois o encontra entre os mesmos cartões embaralhados. */
export function ChosenGame({ profile, training, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [trialIdx, setTrialIdx] = useState(0);
  const [cards, setCards] = useState(() => pickTargets(profile.cardCount, profile.difficulty));
  const [order, setOrder] = useState<string[]>([]);
  const [chosen, setChosen] = useState<{ id: string; rt: number }>({ id: '', rt: 0 });
  const [tapped, setTapped] = useState(-1);
  const trials = useRef<ChosenTrial[]>([]);
  const t0 = useRef(0);
  /** Aceita só um toque por fase (toques duplos não trocam a escolha nem gravam em dobro). */
  const answered = useRef(false);

  const startChoose = () => {
    answered.current = false;
    t0.current = performance.now();
    setPhase('choose');
  };

  const next = () => {
    if (trialIdx + 1 >= profile.trials) {
      onFinish({ cards: [], distractors: [], trials: trials.current });
      return;
    }
    setTrialIdx(trialIdx + 1);
    setCards(pickTargets(profile.cardCount, profile.difficulty));
    setPhase('between');
  };

  const onChoose = (i: number) => {
    if (answered.current) return;
    answered.current = true;
    setChosen({ id: cards[i], rt: performance.now() - t0.current });
    setPhase('blank');
  };

  const onBlankDone = () => {
    setOrder(reshuffle(cards));
    answered.current = false;
    t0.current = performance.now();
    setPhase('find');
  };

  const onFind = (i: number) => {
    if (answered.current) return;
    answered.current = true;
    const rt = performance.now() - t0.current;
    const id = order[i];
    const correct = id === chosen.id;
    trials.current.push({
      kind: 'escolhida',
      cards,
      chosen: chosen.id,
      chooseRtMs: Math.round(chosen.rt),
      response: {
        cardId: id,
        correct,
        rtMs: Math.round(rt),
        ...(correct ? {} : { nearestTarget: chosen.id, nearestDiff: diff(id, chosen.id) }),
      },
    });
    setTapped(i);
    if (training) setPhase('feedback');
    else next();
  };

  switch (phase) {
    case 'intro':
      return <Instruction icon="👆" text="Escolha o cartão que você mais gostar. Depois você vai procurá-lo!" onStart={startChoose} />;
    case 'between':
      return <Transition onNext={startChoose} />;
    case 'choose':
      return (
        <div className="play">
          <Prompt icon="👆" text="Escolha um cartão" />
          <CardGrid cards={cards} colors={profile.colors} onTap={onChoose} />
        </div>
      );
    case 'blank':
      return <Blank ms={profile.intervalMs} onDone={onBlankDone} />;
    case 'find':
      return (
        <div className="play">
          <Prompt icon="🔍" text="Onde está o seu cartão?" />
          <CardGrid cards={order} colors={profile.colors} onTap={onFind} />
        </div>
      );
    case 'feedback':
      return <ChosenFeedback order={order} chosen={chosen.id} tapped={tapped} colors={profile.colors} onDone={next} />;
  }
}

function ChosenFeedback({
  order,
  chosen,
  tapped,
  colors,
  onDone,
}: {
  order: string[];
  chosen: string;
  tapped: number;
  colors: boolean;
  onDone: () => void;
}) {
  useAfter(2000, onDone);
  const ok = order[tapped] === chosen;
  const states: CardState[] = order.map((c, i) => (c === chosen ? 'hit' : i === tapped ? 'wrong' : ''));
  return (
    <div className="play">
      <FeedbackBadge ok={ok} />
      <CardGrid cards={order} colors={colors} states={states} />
    </div>
  );
}
