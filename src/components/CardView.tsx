import { parseCard, SHAPE_COLOR } from '../lib/cards';
import type { Layout, Shape } from '../lib/types';

// Cartão 120×90 (retângulo 4:3).
const POS: Record<Layout, [number, number][][]> = {
  centro: [
    [[60, 45]],
    [[45, 45], [75, 45]],
    [[60, 31], [45, 58], [75, 58]],
    [[46, 31], [74, 31], [46, 59], [74, 59]],
  ],
  cantos: [
    [[22, 20]],
    [[22, 20], [98, 70]],
    [[22, 20], [98, 20], [98, 70]],
    [[22, 20], [98, 20], [22, 70], [98, 70]],
  ],
  linha: [
    [[60, 70]],
    [[40, 70], [80, 70]],
    [[30, 70], [60, 70], [90, 70]],
    [[24, 70], [48, 70], [72, 70], [96, 70]],
  ],
  coluna: [
    [[22, 45]],
    [[22, 30], [22, 60]],
    [[22, 20], [22, 45], [22, 70]],
    [[22, 14], [22, 35], [22, 56], [22, 77]],
  ],
};

function Symbol({ shape, x, y, r, fill }: { shape: Shape; x: number; y: number; r: number; fill: string }) {
  switch (shape) {
    case 'circulo':
      return <circle cx={x} cy={y} r={r * 0.85} fill={fill} />;
    case 'quadrado':
      return <rect x={x - r * 0.78} y={y - r * 0.78} width={r * 1.56} height={r * 1.56} fill={fill} />;
    case 'triangulo':
      return <polygon points={`${x},${y - r} ${x + r},${y + r * 0.75} ${x - r},${y + r * 0.75}`} fill={fill} />;
    case 'losango':
      return <polygon points={`${x},${y - r} ${x + r * 0.8},${y} ${x},${y + r} ${x - r * 0.8},${y}`} fill={fill} />;
    case 'estrela': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? r : r * 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${(x + rr * Math.cos(a)).toFixed(2)},${(y + rr * Math.sin(a)).toFixed(2)}`);
      }
      return <polygon points={pts.join(' ')} fill={fill} />;
    }
    case 'cruz': {
      const t = r * 0.32;
      return (
        <polygon
          fill={fill}
          points={[
            [x - t, y - r], [x + t, y - r], [x + t, y - t], [x + r, y - t], [x + r, y + t], [x + t, y + t],
            [x + t, y + r], [x - t, y + r], [x - t, y + t], [x - r, y + t], [x - r, y - t], [x - t, y - t],
          ].map((p) => p.join(',')).join(' ')}
        />
      );
    }
  }
}

export function CardView({ id, colors }: { id: string; colors: boolean }) {
  const c = parseCard(id);
  const fill = colors ? SHAPE_COLOR[c.shape] : '#212529';
  const r = c.layout === 'coluna' && c.count === 4 ? 8.5 : 10;
  return (
    <svg viewBox="0 0 120 90" className="card-svg" aria-hidden="true">
      <rect x="1.5" y="1.5" width="117" height="87" rx="9" className="card-bg" />
      {POS[c.layout][c.count - 1].map(([x, y], i) => (
        <Symbol key={i} shape={c.shape} x={x} y={y} r={r} fill={fill} />
      ))}
    </svg>
  );
}
