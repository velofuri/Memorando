import { jsPDF } from 'jspdf';
import { describeCard } from './cards';
import { groupKey, secs, summarize, type SpanAttempt } from './summary';
import { DIFFICULTY_LABEL, MODE_LABEL, MODE_SHORT, type Patient, type Session } from './types';
import { DISCLAIMER, download, fmtAge, fmtDate, fmtDateTime } from './util';

// ---------------------------------------------------------------- CSV

export function exportCsv(patient: Patient, sessions: Session[]) {
  const head = [
    'codigo', 'sessao', 'data', 'idade_meses', 'modo', 'perfil', 'treino', 'ensaio', 'tardia',
    'cartao', 'descricao', 'correto', 'tempo_ms', 'alvo_mais_parecido', 'atributos_diferentes', 'observacao',
  ];
  const rows: (string | number)[][] = [];
  for (const s of sessions) {
    const base = [patient.code, s.id ?? '', fmtDateTime(s.startedAt), s.ageMonths, MODE_SHORT[s.mode], s.profile.name, s.training ? 'sim' : 'nao'];
    s.trials.forEach((t, i) => {
      const n = i + 1;
      switch (t.kind) {
        case 'escolhida': {
          const r = t.response;
          rows.push([...base, n, 'nao', r.cardId, describeCard(r.cardId), r.correct ? 1 : 0, r.rtMs, r.nearestTarget ?? '', r.nearestDiff ?? '', `escolhido=${t.chosen}; tempo_escolha=${t.chooseRtMs}`]);
          break;
        }
        case 'conjunto':
          for (const r of t.selected)
            rows.push([...base, n, t.delayed ? 'sim' : 'nao', r.cardId, describeCard(r.cardId), r.correct ? 1 : 0, r.rtMs, r.nearestTarget ?? '', r.nearestDiff ?? '', '']);
          rows.push([...base, n, t.delayed ? 'sim' : 'nao', '', '', '', t.durationMs, '', '', `resumo: acertos=${t.hits}; falsos_positivos=${t.falseAlarms}; omissoes=${t.misses}`]);
          break;
        case 'desenho':
          for (const c of t.recalled) rows.push([...base, n, t.delayed ? 'sim' : 'nao', c, describeCard(c), 1, '', '', '', '']);
          rows.push([...base, n, t.delayed ? 'sim' : 'nao', '', '', '', '', '', '', `resumo: lembrados=${t.recalled.length}; intrusoes=${t.intrusions}`]);
          break;
        case 'span':
          rows.push([...base, n, 'nao', '', '', t.correct ? 1 : 0, t.durationMs, '', '', `tamanho=${t.length}; sequencia=${t.sequence.join('-')}; resposta=${t.response.join('-')}`]);
          break;
      }
    });
  }
  const esc = (v: string | number) => {
    const s = String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
  download(`memoria_${patient.code}_${new Date().toISOString().slice(0, 10)}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

// ---------------------------------------------------------------- PDF

/** A fonte padrão do PDF só cobre Latin-1: troca símbolos que ficariam ilegíveis. */
const latin1 = (s: string) =>
  s.replace(/[–—]/g, '-').replace(/→/g, '>').replace(/✓/g, '+').replace(/✗/g, 'x').replace(/[^\x00-\xff]/g, '?');

const M = 15; // margem
const PAGE_H = 297;
const W = 210 - 2 * M;

/** extraLast: o último ponto (evocação tardia) fica separado da linha, em laranja. */
function chart(doc: jsPDF, x: number, y: number, w: number, h: number, values: number[], labels: string[], max: number, extraLast = false) {
  const pad = 8;
  const n = values.length;
  const px = (i: number) => x + pad + (n <= 1 ? (w - 2 * pad) / 2 : (i * (w - 2 * pad)) / (n - 1));
  const py = (v: number) => y + h - 6 - (v / Math.max(1, max)) * (h - 12);
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  for (const t of [0, max]) {
    doc.line(x + pad, py(t), x + w - pad, py(t));
    doc.setFontSize(7).setTextColor(120).text(String(t), x + pad - 2, py(t) + 1, { align: 'right' });
  }
  doc.setDrawColor(59, 91, 219).setLineWidth(0.6);
  const lineEnd = extraLast ? n - 1 : n;
  for (let i = 1; i < lineEnd; i++) doc.line(px(i - 1), py(values[i - 1]), px(i), py(values[i]));
  values.forEach((v, i) => {
    if (extraLast && i === n - 1) doc.setFillColor(250, 176, 5);
    else doc.setFillColor(59, 91, 219);
    doc.circle(px(i), py(v), 1, 'F');
    doc.setFontSize(7).setTextColor(40).text(String(v), px(i), py(v) - 2, { align: 'center' });
    doc.setTextColor(120).text(labels[i], px(i), y + h + 1, { align: 'center' });
  });
  doc.setTextColor(0);
}

/** Gráfico do modo sequência: tamanho por tentativa, ● verde = acerto, ✕ vermelho = erro, tracejado = span. */
function spanChart(doc: jsPDF, x: number, y: number, w: number, h: number, attempts: SpanAttempt[], span: number, max: number) {
  const padL = 10;
  const padR = 18;
  const n = attempts.length;
  const px = (i: number) => x + padL + (n <= 1 ? (w - padL - padR) / 2 : (i * (w - padL - padR)) / (n - 1));
  const py = (v: number) => y + h - 4 - (v / Math.max(1, max)) * (h - 8);
  doc.setLineWidth(0.15).setDrawColor(215);
  doc.setFont('helvetica', 'normal');
  for (let t = 0; t <= max; t++) {
    doc.line(x + padL, py(t), x + w - padR, py(t));
    doc.setFontSize(6.5).setTextColor(120).text(String(t), x + padL - 2, py(t) + 1, { align: 'right' });
  }
  if (span > 0) {
    doc.setDrawColor(59, 91, 219).setLineWidth(0.4).setLineDashPattern([1.2, 1], 0);
    doc.line(x + padL, py(span), x + w - padR, py(span));
    doc.setLineDashPattern([], 0);
    doc.setFontSize(7).setTextColor(59, 91, 219).text(`span ${span}`, x + w - padR + 2, py(span) + 1);
  }
  doc.setDrawColor(173, 181, 189).setLineWidth(0.3);
  for (let i = 1; i < n; i++) doc.line(px(i - 1), py(attempts[i - 1].length), px(i), py(attempts[i].length));
  attempts.forEach((a, i) => {
    const cx = px(i);
    const cy = py(a.length);
    if (a.correct) {
      doc.setFillColor(47, 158, 68).circle(cx, cy, 1.3, 'F');
    } else {
      doc.setDrawColor(224, 49, 49).setLineWidth(0.6);
      doc.line(cx - 1.2, cy - 1.2, cx + 1.2, cy + 1.2);
      doc.line(cx + 1.2, cy - 1.2, cx - 1.2, cy + 1.2);
    }
    doc.setFontSize(6.5).setTextColor(120).text(`T${a.n}`, cx, y + h + 2, { align: 'center' });
  });
  // Legenda
  const ly = y + h + 6.5;
  doc.setFontSize(7).setTextColor(90);
  doc.setFillColor(47, 158, 68).circle(x + padL + 1, ly - 0.8, 1, 'F');
  doc.text('acertou', x + padL + 3.5, ly);
  doc.setDrawColor(224, 49, 49).setLineWidth(0.5);
  doc.line(x + padL + 19, ly - 1.8, x + padL + 21, ly + 0.2);
  doc.line(x + padL + 21, ly - 1.8, x + padL + 19, ly + 0.2);
  doc.text('errou', x + padL + 23, ly);
  doc.setDrawColor(59, 91, 219).setLineWidth(0.4).setLineDashPattern([1.2, 1], 0);
  doc.line(x + padL + 36, ly - 0.8, x + padL + 42, ly - 0.8);
  doc.setLineDashPattern([], 0);
  doc.text('maior sequência correta (span)', x + padL + 44, ly);
  doc.setTextColor(0);
}

export function exportPdf(patient: Patient, sessions: Session[]) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = M;
  const ensure = (h: number) => {
    if (y + h > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };
  const text = (s: string, size = 10, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(size);
    const lines = doc.splitTextToSize(latin1(s), W) as string[];
    ensure(lines.length * size * 0.45);
    doc.text(lines, M, y + size * 0.35);
    y += lines.length * size * 0.45 + 1;
  };

  const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt);
  const now = Date.now();

  text('Relatório – Memória Visual', 16, true);
  text(`Paciente: ${patient.code}${patient.nickname ? ` (${patient.nickname})` : ''}`, 11);
  text(`Nascimento: ${fmtDate(new Date(patient.birthDate + 'T00:00:00').getTime())}    Gerado em: ${fmtDateTime(now)}`, 10);
  y += 1;
  doc.setTextColor(140, 60, 0);
  text(DISCLAIMER, 8.5);
  doc.setTextColor(0);
  y += 3;

  // Tabela-resumo
  text('Resumo das sessões', 12, true);
  const cols = [M, M + 20, M + 34, M + 56, M + 86, M + 98, M + 160];
  const header = ['Data', 'Idade', 'Modo', 'Perfil', 'Treino', 'Resultado', 'Tempo médio'];
  const row = (cells: string[], bold = false) => {
    ensure(6);
    doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(8.5);
    cells.forEach((c, i) => doc.text(latin1(c), cols[i], y + 3));
    y += 5;
  };
  row(header, true);
  doc.setDrawColor(180).line(M, y - 1, M + W, y - 1);
  for (const s of sorted) {
    const sm = summarize(s);
    row([
      fmtDate(s.startedAt),
      fmtAge(s.ageMonths),
      MODE_SHORT[s.mode],
      s.profile.name,
      s.training ? 'sim' : 'não',
      sm.scoreText + (sm.delayed !== undefined ? ` · tardia ${sm.delayed}` : ''),
      sm.meanRtMs !== undefined ? `${(sm.meanRtMs / 1000).toFixed(2)} s` : '–',
    ]);
  }
  y += 4;

  // Evolução por grupo (mesmo modo + perfil, sem treino)
  const groups = new Map<string, Session[]>();
  for (const s of sorted.filter((s) => !s.training)) {
    const k = groupKey(s);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  const evo = [...groups.values()].filter((g) => g.length >= 2);
  if (evo.length) {
    text('Evolução entre sessões (mesmo modo e perfil, sem treino)', 12, true);
    for (const g of evo) {
      ensure(48);
      text(`${MODE_LABEL[g[0].mode]} – perfil ${g[0].profile.name}`, 9.5, true);
      const sm = g.map(summarize);
      chart(doc, M, y, W * 0.7, 36, sm.map((x) => x.score), g.map((s) => fmtDate(s.startedAt).slice(0, 5)), sm[0].max);
      y += 44;
    }
  }

  // Detalhe por sessão
  text('Detalhamento', 12, true);
  for (const s of sorted) {
    const sm = summarize(s);
    ensure(30);
    y += 2;
    doc.setDrawColor(220).line(M, y, M + W, y);
    y += 2;
    text(`${fmtDateTime(s.startedAt)} – ${MODE_LABEL[s.mode]}${s.training ? ' (treino)' : ''}`, 10, true);
    const p = s.profile;
    text(
      s.mode === 'span'
        ? `Perfil ${p.name}: ${p.cardCount} cartões na grade, dificuldade ${DIFFICULTY_LABEL[p.difficulty]}, ` +
            `${p.colors ? 'com cores' : 'preto e branco'}. Cada cartão acende por 0,9 s.`
        : `Perfil ${p.name}: ${p.cardCount} cartões, exibição ${p.exposureMs / 1000}s, intervalo ${p.intervalMs / 1000}s, ` +
            `dificuldade ${DIFFICULTY_LABEL[p.difficulty]}, ${p.colors ? 'com cores' : 'preto e branco'}, ${p.trials} ensaios.`,
      8.5,
    );
    for (const d of sm.details) text('- ' + d, 9);
    if (sm.attempts?.length) {
      ensure(48);
      y += 1;
      spanChart(doc, M, y, W * 0.75, 34, sm.attempts, sm.score, sm.max);
      y += 46;
      const hasFirst = sm.attempts.some((a) => a.firstTapMs !== undefined);
      const c = [M, M + 16, M + 30, M + 62, M + 104, M + 146, M + 162];
      const head = ['Tentativa', 'Tamanho', 'Resultado', 'Sequência mostrada', 'Resposta da criança', hasFirst ? '1º toque' : '', 'Total / por toque'];
      const line = (cells: string[], bold = false, wrong: number[] = [], a?: SpanAttempt) => {
        ensure(5);
        doc.setFont('helvetica', bold ? 'bold' : 'normal').setFontSize(7.5);
        cells.forEach((cell, i) => {
          if (i === 2 && a) doc.setTextColor(...((a.correct ? [47, 158, 68] : [201, 42, 42]) as [number, number, number]));
          if (i === 4 && a) {
            // resposta com os toques fora de ordem em vermelho
            let cx = c[4];
            a.response.forEach((v, j) => {
              const part = (j > 0 ? ' > ' : '') + v;
              const isWrong = wrong.includes(j);
              const sep = j > 0 ? ' > ' : '';
              doc.setTextColor(0).text(sep, cx, y + 3);
              cx += doc.getTextWidth(sep);
              doc.setTextColor(...((isWrong ? [201, 42, 42] : [0, 0, 0]) as [number, number, number]));
              doc.text(String(v), cx, y + 3);
              cx += doc.getTextWidth(part) - doc.getTextWidth(sep);
            });
            doc.setTextColor(0);
            return;
          }
          doc.text(latin1(cell), c[i], y + 3);
          doc.setTextColor(0);
        });
        y += 4.6;
      };
      line(head, true);
      doc.setDrawColor(200).setLineWidth(0.2).line(M, y - 0.6, M + W, y - 0.6);
      for (const a of sm.attempts) {
        const wrong = a.response.flatMap((v, j) => (v === a.sequence[j] ? [] : [j]));
        line(
          [
            `T${a.n}`,
            String(a.length),
            a.correct ? 'Acertou' : `Errou no ${a.firstError}º toque`,
            a.sequence.join(' > '),
            '',
            a.firstTapMs !== undefined ? secs(a.firstTapMs) : hasFirst ? '-' : '',
            `${secs(a.durationMs)} / ${secs(a.perTapMs)}`,
          ],
          false,
          wrong,
          a,
        );
      }
      y += 1;
      text(
        'Números = posição do cartão na grade, da esquerda para a direita e de cima para baixo (1 = canto superior ' +
          'esquerdo). Em vermelho, os toques fora da ordem. Tempo total = do fim da demonstração até o último toque.',
        7,
      );
    }
    if (sm.curve.length > 1 && s.mode !== 'escolhida') {
      ensure(42);
      const labels = sm.curve.map((_, i) => `E${i + 1}`);
      const vals = [...sm.curve];
      if (sm.delayed !== undefined) {
        vals.push(sm.delayed);
        labels.push('Tardia');
      }
      chart(doc, M, y, W * 0.7, 32, vals, labels, sm.curveMax, sm.delayed !== undefined);
      y += 40;
    }
    if (s.notes.trim()) text('Observações: ' + s.notes.trim(), 9);
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(130);
    doc.text(`${patient.code} · página ${i}/${pages}`, 210 - M, PAGE_H - 8, { align: 'right' });
  }
  doc.save(`relatorio_${patient.code}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
