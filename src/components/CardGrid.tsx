import { useLayoutEffect, useRef, useState } from 'react';
import { CardView } from './CardView';

export type CardState = '' | 'selected' | 'hit' | 'wrong' | 'missed' | 'lit';

const ASPECT = 4 / 3;
const GAP = 16;
const MAX_W = 280;

/**
 * Escolhe o número de colunas. Entre as opções com cartões até 20% menores que o máximo possível,
 * prefere a grade com menos posições vazias (ex.: 8 cartões em 4×2 em vez de 3+3+2).
 */
function fit(n: number, w: number, h: number) {
  const options = Array.from({ length: n }, (_, i) => {
    const cols = i + 1;
    const rows = Math.ceil(n / cols);
    const cardW = Math.min((w - GAP * (cols - 1)) / cols, ((h - GAP * (rows - 1)) / rows) * ASPECT, MAX_W);
    return { cols, cardW, empty: rows * cols - n };
  });
  const maxW = Math.max(...options.map((o) => o.cardW));
  const best = options
    .filter((o) => o.cardW >= maxW * 0.8)
    .sort((a, b) => a.empty - b.empty || b.cardW - a.cardW)[0];
  return { cols: best.cols, cardW: Math.max(40, Math.floor(best.cardW)) };
}

interface Props {
  cards: string[];
  colors: boolean;
  states?: CardState[];
  onTap?: (index: number) => void;
  disabled?: boolean;
}

export function CardGrid({ cards, colors, states, onTap, disabled }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });

  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cols, cardW } = fit(cards.length, size.w, size.h);

  return (
    <div className="grid-host" ref={host}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${cardW}px)`, gap: GAP }}>
        {cards.map((c, i) => (
          <button
            key={`${c}-${i}`}
            type="button"
            className={`card ${states?.[i] ?? ''}`}
            style={{ width: cardW, height: cardW / ASPECT }}
            disabled={disabled || !onTap}
            onClick={() => onTap?.(i)}
          >
            <CardView id={c} colors={colors} />
          </button>
        ))}
      </div>
    </div>
  );
}
