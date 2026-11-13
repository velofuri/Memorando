import { useRef, useState } from 'react';
import { ChosenGame } from '../games/ChosenGame';
import { GameShell, Reward, type GameResult } from '../games/common';
import { SetGame } from '../games/SetGame';
import { SpanGame } from '../games/SpanGame';
import { db } from '../lib/db';
import type { Mode, Patient, Profile, Session } from '../lib/types';
import { ageMonths } from '../lib/util';

export interface GameConfig {
  patient: Patient;
  mode: Mode;
  profile: Profile;
  training: boolean;
  /** Quando presente, aplica a evocação tardia desta sessão. */
  delayedSession?: Session;
}

interface Props {
  cfg: GameConfig;
  onAbort: () => void;
  onFinished: () => void;
}

export function GameScreen({ cfg, onAbort, onFinished }: Props) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const startedAt = useRef(Date.now());
  const saving = useRef(false);
  const { patient, mode, profile, training, delayedSession } = cfg;

  const save = async (r: GameResult) => {
    if (saving.current) return; // toque duplo no último botão
    saving.current = true;
    try {
      if (delayedSession?.id !== undefined) {
        const fresh = await db.sessions.get(delayedSession.id);
        await db.sessions.update(delayedSession.id, {
          trials: [...(fresh?.trials ?? delayedSession.trials), ...r.trials],
          delayedPending: false,
        });
      } else {
        const s: Session = {
          patientId: patient.id!,
          mode,
          profile: { ...profile },
          training,
          startedAt: startedAt.current,
          finishedAt: Date.now(),
          ageMonths: ageMonths(patient.birthDate, startedAt.current),
          cards: r.cards,
          distractors: r.distractors,
          trials: r.trials,
          notes: '',
          delayedPending: profile.delayedRecall && (mode === 'conjunto' || mode === 'desenho'),
        };
        await db.sessions.add(s);
      }
      setDone(true);
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) {
    return (
      <div className="game">
        <div className="center-screen">
          <p className="error">Não foi possível salvar a sessão: {error}</p>
          <button type="button" className="kid-btn" onClick={onAbort}>Voltar</button>
        </div>
      </div>
    );
  }
  if (done) return <Reward onContinue={onFinished} />;

  const delayed = delayedSession ? { cards: delayedSession.cards, distractors: delayedSession.distractors } : undefined;

  return (
    <GameShell onAbort={onAbort}>
      {mode === 'escolhida' && <ChosenGame profile={profile} training={training} onFinish={save} />}
      {(mode === 'conjunto' || mode === 'desenho') && (
        <SetGame mode={mode} profile={profile} training={training} delayed={delayed} onFinish={save} />
      )}
      {mode === 'span' && <SpanGame profile={profile} training={training} onFinish={save} />}
    </GameShell>
  );
}
