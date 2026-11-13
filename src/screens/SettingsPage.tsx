import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { CardView } from '../components/CardView';
import { PinPad } from '../components/PinPad';
import { exportBackup, importBackup } from '../lib/backup';
import { ALL_CARDS } from '../lib/cards';
import { checkPin, db, getKV, setKV } from '../lib/db';
import { DIFFICULTY_LABEL, type Difficulty, type Profile } from '../lib/types';
import { fmtDateTime, hashPin } from '../lib/util';

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const profiles = useLiveQuery(() => db.profiles.toArray(), []);
  const backup = useLiveQuery(async () => ({ at: await getKV<number>('lastBackupAt') }), []);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!profiles || !backup) return null;

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    if (!confirm('Importar este backup vai SUBSTITUIR todos os pacientes e sessões deste dispositivo. Continuar?')) return;
    try {
      const r = await importBackup(f);
      setMsg(`Backup importado: ${r.patients} pacientes, ${r.sessions} sessões.`);
    } catch (e) {
      setMsg(`Erro: ${(e as Error).message}`);
    }
  };

  return (
    <div className="pro">
      <header className="pro-header">
        <button type="button" onClick={onBack}>← Voltar</button>
        <h1>Configurações</h1>
      </header>

      <section className="panel">
        <h2>Backup dos dados</h2>
        <p className="muted">
          Os dados ficam apenas neste dispositivo. Limpar os dados do navegador ou perder o tablet apaga tudo.
          Faça backups regulares e guarde o arquivo em local seguro (contém dados de saúde).
        </p>
        <p>Último backup: <strong>{backup.at ? fmtDateTime(backup.at) : 'nunca'}</strong></p>
        <div className="actions">
          <button type="button" className="primary" onClick={() => exportBackup().then(() => setMsg('Backup exportado.'))}>
            Exportar backup (JSON)
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}>Importar backup…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        {msg && <p className="banner">{msg}</p>}
      </section>

      <section className="panel">
        <div className="row-between">
          <h2>Perfis de teste</h2>
          <button
            type="button"
            onClick={() =>
              db.profiles.add({ name: 'Novo perfil', cardCount: 8, exposureMs: 5000, intervalMs: 3000, difficulty: 'medio', colors: false, trials: 5, delayedRecall: false })
            }
          >
            + Novo perfil
          </button>
        </div>
        <p className="muted small">
          Cada sessão guarda uma cópia do perfil usado. A evolução compara sessões com o mesmo nome de perfil — evite
          renomear ou alterar um perfil já usado; prefira criar outro.
        </p>
        {profiles.map((p) => (
          <ProfileEditor key={p.id} profile={p} canDelete={profiles.length > 1} />
        ))}
      </section>

      <ChangePin />

      <section className="panel">
        <h2>Banco de cartões ({ALL_CARDS.length})</h2>
        <p className="muted small">6 formas × 4 quantidades × 4 posições. Os níveis de dificuldade controlam quão parecidos são os cartões.</p>
        <div className="card-bank">
          {ALL_CARDS.map((c) => (
            <div key={c} className="card mini"><CardView id={c} colors={false} /></div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileEditor({ profile, canDelete }: { profile: Profile; canDelete: boolean }) {
  const [p, setP] = useState(profile);
  const dirty = JSON.stringify(p) !== JSON.stringify(profile);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || min));

  return (
    <div className="form-card profile">
      <label>Nome<input value={p.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label>Cartões<input type="number" min={2} max={12} value={p.cardCount} onChange={(e) => set('cardCount', num(e.target.value, 2, 12))} /></label>
      <label>Exibição (s)<input type="number" min={1} max={30} step={0.5} value={p.exposureMs / 1000} onChange={(e) => set('exposureMs', num(e.target.value, 1, 30) * 1000)} /></label>
      <label>Intervalo (s)<input type="number" min={0} max={60} step={0.5} value={p.intervalMs / 1000} onChange={(e) => set('intervalMs', Math.max(0, Number(e.target.value) || 0) * 1000)} /></label>
      <label>Ensaios<input type="number" min={1} max={10} value={p.trials} onChange={(e) => set('trials', num(e.target.value, 1, 10))} /></label>
      <label>
        Dificuldade
        <select value={p.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
          {(Object.keys(DIFFICULTY_LABEL) as Difficulty[]).map((d) => (
            <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>
          ))}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={p.colors} onChange={(e) => set('colors', e.target.checked)} />Cores</label>
      <label className="check"><input type="checkbox" checked={p.delayedRecall} onChange={(e) => set('delayedRecall', e.target.checked)} />Evocação tardia</label>
      <div className="actions">
        {canDelete && (
          <button type="button" className="danger small" onClick={() => confirm(`Excluir o perfil "${profile.name}"?`) && db.profiles.delete(profile.id!)}>
            Excluir
          </button>
        )}
        <button type="button" className="primary" disabled={!dirty || !p.name.trim()} onClick={() => db.profiles.put({ ...p, name: p.name.trim() })}>
          Salvar
        </button>
      </div>
    </div>
  );
}

function ChangePin() {
  const [step, setStep] = useState<'idle' | 'old' | 'new' | 'confirm'>('idle');
  const [first, setFirst] = useState('');
  const [err, setErr] = useState<string>();
  const [ok, setOk] = useState(false);

  return (
    <section className="panel">
      <h2>PIN do profissional</h2>
      {ok && <p className="banner">PIN alterado.</p>}
      {step === 'idle' && <button type="button" onClick={() => { setOk(false); setStep('old'); }}>Alterar PIN</button>}
      {step === 'old' && (
        <PinPad
          title="PIN atual"
          error={err}
          onCancel={() => { setStep('idle'); setErr(undefined); }}
          onSubmit={async (pin) => {
            if (await checkPin(pin)) { setErr(undefined); setStep('new'); } else setErr('PIN incorreto');
          }}
        />
      )}
      {step === 'new' && (
        <PinPad title="Novo PIN (4 a 8 dígitos)" onCancel={() => setStep('idle')} onSubmit={(pin) => { setFirst(pin); setStep('confirm'); }} />
      )}
      {step === 'confirm' && (
        <PinPad
          title="Confirme o novo PIN"
          error={err}
          onCancel={() => { setStep('idle'); setErr(undefined); }}
          onSubmit={async (pin) => {
            if (pin !== first) { setErr('Os PINs não conferem'); setStep('new'); return; }
            await setKV('pinHash', hashPin(pin));
            setErr(undefined);
            setOk(true);
            setStep('idle');
          }}
        />
      )}
    </section>
  );
}
