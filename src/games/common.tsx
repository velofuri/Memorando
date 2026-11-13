import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CardGrid } from '../components/CardGrid';
import { PinPad } from '../components/PinPad';
import { checkPin } from '../lib/db';
import type { Trial } from '../lib/types';

export interface GameResult {
  cards: string[];
  distractors: string[];
  trials: Trial[];
}

/** Executa cb depois de ms, sempre com a versão mais recente de cb. */
export function useAfter(ms: number, cb: () => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    const t = setTimeout(() => ref.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);
}

export function GameShell({ children, onAbort }: { children: ReactNode; onAbort: () => void }) {
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string>();
  return (
    <div className="game">
      <button type="button" className="exit-btn" aria-label="Sair (profissional)" onClick={() => setAsking(true)}>
        ⚙
      </button>
      {children}
      {asking && (
        <div className="modal">
          <PinPad
            title="PIN do profissional para interromper"
            error={err}
            onSubmit={async (p) => {
              if (await checkPin(p)) onAbort();
              else setErr('PIN incorreto');
            }}
            onCancel={() => {
              setAsking(false);
              setErr(undefined);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function Instruction({
  icon,
  text,
  onStart,
  label = 'Começar',
}: {
  icon: string;
  text: string;
  onStart: () => void;
  label?: string;
}) {
  return (
    <div className="center-screen">
      <div className="big-icon" aria-hidden="true">{icon}</div>
      <p className="kid-text">{text}</p>
      <button type="button" className="kid-btn" onClick={onStart}>{label}</button>
    </div>
  );
}

/** Tela neutra do intervalo de retenção. */
export function Blank({ ms, onDone }: { ms: number; onDone: () => void }) {
  useAfter(ms, onDone);
  return (
    <div className="center-screen">
      <div className="blank-dot" aria-label="Aguarde" />
    </div>
  );
}

export function Exposure({
  cards,
  colors,
  ms,
  onDone,
}: {
  cards: string[];
  colors: boolean;
  ms: number;
  onDone: () => void;
}) {
  useAfter(ms, onDone);
  return (
    <div className="play">
      <Prompt icon="👀" text="Olhe bem!" />
      <CardGrid cards={cards} colors={colors} />
      <div className="timebar"><span style={{ animationDuration: `${ms}ms` }} /></div>
    </div>
  );
}

export function Prompt({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="prompt">
      <span aria-hidden="true">{icon}</span> {text}
    </div>
  );
}

export function Transition({ onNext, text = 'Muito bem! Vamos continuar?' }: { onNext: () => void; text?: string }) {
  return <Instruction icon="⭐" text={text} onStart={onNext} label="Continuar" />;
}

export function Reward({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="game">
      <div className="center-screen reward">
        <div className="stars" aria-hidden="true">
          <span>⭐</span><span>🌟</span><span>⭐</span>
        </div>
        <p className="kid-text">Você terminou! Obrigado por jogar!</p>
        <button type="button" className="kid-btn" onClick={onContinue}>Chamar o profissional</button>
      </div>
    </div>
  );
}

export function FeedbackBadge({ ok }: { ok: boolean }) {
  return <div className={`feedback-badge ${ok ? 'ok' : 'bad'}`}>{ok ? '✓ Acertou!' : '✗ Não foi esse'}</div>;
}
