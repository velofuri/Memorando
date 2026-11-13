import { secs, type SpanAttempt } from '../lib/summary';

/** Gráfico do modo sequência: tamanho de cada tentativa, acerto (●) ou erro (✕), e o span alcançado. */
export function SpanChart({ attempts, span, max }: { attempts: SpanAttempt[]; span: number; max: number }) {
  const n = attempts.length;
  const W = Math.max(360, n * 56 + 60);
  const H = 210;
  const pad = { l: 40, r: 70, t: 16, b: 34 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((t) => t === 0 || t % (max > 8 ? 2 : 1) === 0);

  return (
    <figure className="span-chart">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={`Span ${span}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="chart-label">{t}</text>
          </g>
        ))}
        <text x={12} y={pad.t + ih / 2} className="chart-label" transform={`rotate(-90 12 ${pad.t + ih / 2})`} textAnchor="middle">
          cartões na sequência
        </text>
        {span > 0 && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(span)} y2={y(span)} className="chart-ref" />
            <text x={W - pad.r + 6} y={y(span) + 4} className="chart-ref-label">span {span}</text>
          </g>
        )}
        <polyline points={attempts.map((a, i) => `${x(i)},${y(a.length)}`).join(' ')} className="chart-line muted-line" />
        {attempts.map((a, i) => (
          <g key={a.n}>
            {a.correct ? (
              <circle cx={x(i)} cy={y(a.length)} r={7} className="dot-ok" />
            ) : (
              <path
                d={`M${x(i) - 6},${y(a.length) - 6} L${x(i) + 6},${y(a.length) + 6} M${x(i) + 6},${y(a.length) - 6} L${x(i) - 6},${y(a.length) + 6}`}
                className="dot-bad"
              />
            )}
            <text x={x(i)} y={H - 10} textAnchor="middle" className="chart-label">T{a.n}</text>
          </g>
        ))}
      </svg>
      <figcaption className="legend">
        <span><i className="lg-ok" /> acertou</span>
        <span><i className="lg-bad">✕</i> errou</span>
        <span><i className="lg-ref" /> maior sequência correta (span)</span>
      </figcaption>
    </figure>
  );
}

export function SpanTable({ attempts }: { attempts: SpanAttempt[] }) {
  const hasFirst = attempts.some((a) => a.firstTapMs !== undefined);
  return (
    <div className="table-scroll">
      <table className="table compact">
        <thead>
          <tr>
            <th>Tentativa</th>
            <th>Tamanho</th>
            <th>Resultado</th>
            <th>Sequência mostrada</th>
            <th>Resposta da criança</th>
            {hasFirst && <th>1º toque</th>}
            <th>Tempo total</th>
            <th>Por toque</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.n}>
              <td>T{a.n}</td>
              <td>{a.length}</td>
              <td className={a.correct ? 'ok' : 'bad'}>
                {a.correct ? '✓ Acertou' : `✕ Errou no ${a.firstError}º toque`}
              </td>
              <td className="mono">{a.sequence.join(' → ')}</td>
              <td className="mono">
                {a.response.map((v, j) => (
                  <span key={j}>
                    {j > 0 && ' → '}
                    <span className={v === a.sequence[j] ? '' : 'bad'}>{v}</span>
                  </span>
                ))}
              </td>
              {hasFirst && <td>{a.firstTapMs !== undefined ? secs(a.firstTapMs) : '–'}</td>}
              <td>{secs(a.durationMs)}</td>
              <td>{secs(a.perTapMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        Números = posição do cartão na grade, contando da esquerda para a direita e de cima para baixo
        (1 = canto superior esquerdo). Em vermelho, os toques fora da ordem. Tempo total = do fim da
        demonstração até o último toque.
      </p>
    </div>
  );
}
