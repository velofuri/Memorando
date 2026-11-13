import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { db } from '../lib/db';
import { groupKey, summarize } from '../lib/summary';
import { DIFFICULTY_LABEL, MODE_HELP, MODE_LABEL, MODE_SHORT, type Mode, type Session } from '../lib/types';
import { ageMonths, DISCLAIMER, fmtAge, fmtDate, fmtDateTime } from '../lib/util';
import type { GameConfig } from './GameScreen';

interface Props {
  patientId: number;
  onBack: () => void;
  onStart: (cfg: GameConfig) => void;
}

const MODES: Mode[] = ['escolhida', 'conjunto', 'desenho', 'span'];

function enterFullscreen() {
  // Sem suporte ou sem permissão: o jogo funciona normalmente fora da tela cheia.
  document.documentElement.requestFullscreen?.().catch(() => {});
}

export function PatientPage({ patientId, onBack, onStart }: Props) {
  const patient = useLiveQuery(() => db.patients.get(patientId), [patientId]);
  const sessions = useLiveQuery(
    () => db.sessions.where('patientId').equals(patientId).reverse().sortBy('startedAt'),
    [patientId],
  );
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const [mode, setMode] = useState<Mode>('conjunto');
  const [profileId, setProfileId] = useState<number>();
  const [training, setTraining] = useState(false);
  const [open, setOpen] = useState<number>();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!patient || !sessions || !profiles) return null;

  const profile = profiles.find((p) => p.id === profileId) ?? profiles[0];
  const pending = sessions.filter((s) => s.delayedPending);

  // Grupos para evolução (mesmo modo e perfil, sem treino), em ordem cronológica.
  const groups = new Map<string, Session[]>();
  for (const s of [...sessions].reverse().filter((s) => !s.training)) {
    groups.set(groupKey(s), [...(groups.get(groupKey(s)) ?? []), s]);
  }
  const evo = [...groups.values()].filter((g) => g.length >= 2);

  const start = (delayedSession?: Session) => {
    enterFullscreen();
    if (delayedSession) {
      onStart({ patient, mode: delayedSession.mode, profile: delayedSession.profile, training: delayedSession.training, delayedSession });
    } else if (profile) {
      onStart({ patient, mode, profile, training });
    }
  };

  const deletePatient = async () => {
    if (!confirm(`Excluir o paciente ${patient.code} e todas as ${sessions.length} sessões? Isso não pode ser desfeito.`)) return;
    await db.transaction('rw', db.patients, db.sessions, async () => {
      await db.sessions.where('patientId').equals(patientId).delete();
      await db.patients.delete(patientId);
    });
    onBack();
  };

  return (
    <div className="pro">
      <header className="pro-header">
        <button type="button" onClick={onBack}>← Pacientes</button>
        <h1>
          {patient.code}
          {patient.nickname && <span className="muted"> · {patient.nickname}</span>}
        </h1>
        <span className="muted">
          {fmtAge(ageMonths(patient.birthDate, now))} · nasc. {fmtDate(new Date(patient.birthDate + 'T00:00:00').getTime())}
        </span>
      </header>

      {pending.length > 0 && (
        <section className="panel highlight">
          <h2>Evocação tardia pendente</h2>
          {pending.map((s) => (
            <div key={s.id} className="row-between pending">
              <span>
                {MODE_SHORT[s.mode]} de {fmtDateTime(s.finishedAt)} — há{' '}
                <strong>{Math.floor((now - s.finishedAt) / 60000)} min</strong>
                {now - s.finishedAt < 15 * 60000 && <span className="muted"> (recomendado: 15–20 min)</span>}
              </span>
              <span className="actions">
                <button type="button" onClick={() => db.sessions.update(s.id!, { delayedPending: false })}>Dispensar</button>
                <button type="button" className="primary" onClick={() => start(s)}>Aplicar agora</button>
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h2>Nova sessão</h2>
        <div className="mode-grid">
          {MODES.map((m) => (
            <button key={m} type="button" className={`mode-card ${m === mode ? 'active' : ''}`} onClick={() => setMode(m)}>
              <strong>{MODE_LABEL[m]}</strong>
              <span>{MODE_HELP[m]}</span>
            </button>
          ))}
        </div>
        <div className="form-row">
          <label>
            Perfil
            <select value={profile?.id} onChange={(e) => setProfileId(Number(e.target.value))}>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {profile && (
            <span className="muted small">
              {profile.cardCount} cartões · exibição {profile.exposureMs / 1000}s · intervalo {profile.intervalMs / 1000}s ·{' '}
              {DIFFICULTY_LABEL[profile.difficulty]} · {profile.colors ? 'cores' : 'P&B'} · {profile.trials} ensaios
              {profile.delayedRecall && (mode === 'conjunto' || mode === 'desenho') ? ' · com evocação tardia' : ''}
            </span>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={training} onChange={(e) => setTraining(e.target.checked)} />
          Modo treino/estimulação (mostra acertos e erros; não entra na evolução)
        </label>
        <button type="button" className="primary big" onClick={() => start()} disabled={!profile}>
          Iniciar e entregar o tablet à criança
        </button>
      </section>

      {evo.length > 0 && (
        <section className="panel">
          <h2>Evolução</h2>
          {evo.map((g) => {
            const sm = g.map(summarize);
            return (
              <div key={groupKey(g[0])} className="chart-block">
                <h3>{MODE_LABEL[g[0].mode]} · {g[0].profile.name}</h3>
                <LineChart values={sm.map((x) => x.score)} labels={g.map((s) => fmtDate(s.startedAt).slice(0, 5))} max={sm[0].max} />
              </div>
            );
          })}
        </section>
      )}

      <section className="panel">
        <div className="row-between">
          <h2>Sessões ({sessions.length})</h2>
          <span className="actions">
            <button type="button" disabled={!sessions.length} onClick={() => import('../lib/report').then((m) => m.exportPdf(patient, sessions))}>
              Relatório PDF
            </button>
            <button type="button" disabled={!sessions.length} onClick={() => import('../lib/report').then((m) => m.exportCsv(patient, sessions))}>
              Dados CSV
            </button>
          </span>
        </div>
        {sessions.length === 0 ? (
          <p className="muted">Nenhuma sessão ainda.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Data</th><th>Modo</th><th>Perfil</th><th>Resultado</th><th>Tempo médio</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const sm = summarize(s);
                return (
                  <SessionRow key={s.id} s={s} sm={sm} open={open === s.id} onToggle={() => setOpen(open === s.id ? undefined : s.id)} />
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="row-between">
        <p className="disclaimer">{DISCLAIMER}</p>
        <button type="button" className="danger" onClick={deletePatient}>Excluir paciente</button>
      </div>
    </div>
  );
}

function SessionRow({
  s,
  sm,
  open,
  onToggle,
}: {
  s: Session;
  sm: ReturnType<typeof summarize>;
  open: boolean;
  onToggle: () => void;
}) {
  const [notes, setNotes] = useState(s.notes);
  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td>{fmtDateTime(s.startedAt)}</td>
        <td>
          {MODE_SHORT[s.mode]}
          {s.training && <span className="tag">treino</span>}
        </td>
        <td>{s.profile.name}</td>
        <td>
          {sm.scoreText}
          {sm.delayed !== undefined && <span className="muted"> · tardia {sm.delayed}</span>}
        </td>
        <td>{sm.meanRtMs !== undefined ? `${(sm.meanRtMs / 1000).toFixed(2)} s` : '–'}</td>
        <td>{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr className="detail">
          <td colSpan={6}>
            <ul>
              {sm.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
              <li className="muted">Idade na sessão: {fmtAge(s.ageMonths)}</li>
            </ul>
            {sm.curve.length > 1 && s.mode !== 'escolhida' && (
              <div className="chart-block">
                <h3>Curva de aprendizagem</h3>
                <LineChart
                  values={sm.curve}
                  labels={sm.curve.map((_, i) => `E${i + 1}`)}
                  max={sm.curveMax}
                  extraPoint={sm.delayed !== undefined ? { label: 'Tardia', value: sm.delayed } : undefined}
                />
              </div>
            )}
            <label className="notes">
              Observações do profissional
              <textarea
                value={notes}
                rows={3}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => notes !== s.notes && db.sessions.update(s.id!, { notes })}
              />
            </label>
            <button
              type="button"
              className="danger small"
              onClick={() => confirm('Excluir esta sessão? Isso não pode ser desfeito.') && db.sessions.delete(s.id!)}
            >
              Excluir sessão
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
