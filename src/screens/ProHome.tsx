import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, getKV } from '../lib/db';
import { ageMonths, DISCLAIMER, fmtAge, fmtDate } from '../lib/util';

interface Props {
  onOpen: (patientId: number) => void;
  onSettings: () => void;
  onLock: () => void;
}

const BACKUP_DAYS = 30;

export function ProHome({ onOpen, onSettings, onLock }: Props) {
  const patients = useLiveQuery(() => db.patients.orderBy('code').toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const backup = useLiveQuery(async () => ({ at: await getKV<number>('lastBackupAt') }), []);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  if (!patients || !sessions || !backup) return null;

  const now = Date.now();
  const needsBackup = sessions.length > 0 && (!backup.at || now - backup.at > BACKUP_DAYS * 864e5);
  const q = query.trim().toLowerCase();
  const list = patients.filter(
    (p) => !q || p.code.toLowerCase().includes(q) || (p.nickname ?? '').toLowerCase().includes(q),
  );

  return (
    <div className="pro">
      <header className="pro-header">
        <h1>Memória Visual</h1>
        <div className="actions">
          <button type="button" onClick={onSettings}>Configurações</button>
          <button type="button" onClick={onLock}>🔒 Bloquear</button>
        </div>
      </header>

      {needsBackup && (
        <div className="banner warn">
          {backup.at
            ? `Último backup há ${Math.floor((now - backup.at) / 864e5)} dias.`
            : 'Nenhum backup foi feito ainda.'}{' '}
          Os dados ficam só neste dispositivo.{' '}
          <button type="button" className="link" onClick={onSettings}>Fazer backup</button>
        </div>
      )}

      <section className="panel">
        <div className="row-between">
          <h2>Pacientes</h2>
          <button type="button" className="primary" onClick={() => setAdding(true)}>+ Novo paciente</button>
        </div>
        {adding && (
          <NewPatient
            existing={patients.map((p) => p.code)}
            onCancel={() => setAdding(false)}
            onCreated={(id) => {
              setAdding(false);
              onOpen(id);
            }}
          />
        )}
        <input
          className="search"
          placeholder="Buscar por código ou apelido"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {list.length === 0 ? (
          <p className="muted">Nenhum paciente cadastrado.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Código</th><th>Apelido</th><th>Idade</th><th>Sessões</th><th>Última</th></tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const ss = sessions.filter((s) => s.patientId === p.id);
                const last = Math.max(0, ...ss.map((s) => s.startedAt));
                return (
                  <tr key={p.id} className="clickable" onClick={() => onOpen(p.id!)}>
                    <td><strong>{p.code}</strong></td>
                    <td>{p.nickname || '–'}</td>
                    <td>{fmtAge(ageMonths(p.birthDate, now))}</td>
                    <td>{ss.length}</td>
                    <td>{last ? fmtDate(last) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
      <p className="disclaimer">{DISCLAIMER}</p>
    </div>
  );
}

function nextCode(existing: string[]) {
  const nums = existing.map((c) => Number(/^P-(\d+)$/.exec(c)?.[1] ?? 0));
  return `P-${String(Math.max(0, ...nums) + 1).padStart(4, '0')}`;
}

function NewPatient({
  existing,
  onCancel,
  onCreated,
}: {
  existing: string[];
  onCancel: () => void;
  onCreated: (id: number) => void;
}) {
  const [code, setCode] = useState(() => nextCode(existing));
  const [birth, setBirth] = useState('');
  const [nick, setNick] = useState('');
  const [err, setErr] = useState('');

  const save = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return setErr('Informe o código.');
    if (existing.includes(c)) return setErr('Já existe um paciente com esse código.');
    if (!birth || new Date(birth) > new Date()) return setErr('Informe uma data de nascimento válida.');
    const id = await db.patients.add({ code: c, birthDate: birth, nickname: nick.trim() || undefined, createdAt: Date.now() });
    onCreated(id);
  };

  return (
    <div className="form-card">
      <label>Código<input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <label>Data de nascimento<input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} /></label>
      <label>Apelido (opcional, só para você reconhecer)<input value={nick} onChange={(e) => setNick(e.target.value)} /></label>
      <p className="muted small">Não registre nome completo nem CPF.</p>
      {err && <p className="error">{err}</p>}
      <div className="actions">
        <button type="button" onClick={onCancel}>Cancelar</button>
        <button type="button" className="primary" onClick={save}>Salvar</button>
      </div>
    </div>
  );
}
