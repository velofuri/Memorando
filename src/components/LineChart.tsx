interface Props {
  values: number[];
  labels: string[];
  max: number;
  extraPoint?: { label: string; value: number };
  height?: number;
}

/** Gráfico de linha simples em SVG (curva de aprendizagem / evolução). */
export function LineChart({ values, labels, max, extraPoint, height = 180 }: Props) {
  const n = values.length + (extraPoint ? 1 : 0);
  const W = Math.max(320, n * 70);
  const H = height;
  const pad = { l: 34, r: 16, t: 14, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => pad.t + ih - (v / Math.max(1, max)) * ih;
  const ticks = Array.from(new Set([0, Math.round(max / 2), max]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chart-label">{t}</text>
        </g>
      ))}
      <polyline points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} className="chart-line" />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={5} className="chart-dot" />
          <text x={x(i)} y={y(v) - 10} textAnchor="middle" className="chart-value">{v}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" className="chart-label">{labels[i]}</text>
        </g>
      ))}
      {extraPoint && (
        <g>
          <circle cx={x(n - 1)} cy={y(extraPoint.value)} r={5} className="chart-dot alt" />
          <text x={x(n - 1)} y={y(extraPoint.value) - 10} textAnchor="middle" className="chart-value">{extraPoint.value}</text>
          <text x={x(n - 1)} y={H - 8} textAnchor="middle" className="chart-label">{extraPoint.label}</text>
        </g>
      )}
    </svg>
  );
}
