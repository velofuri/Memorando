import { useEffect, useState } from 'react';
import { PinPad } from './components/PinPad';
import { checkPin, getKV, setKV } from './lib/db';
import { DISCLAIMER, hashPin } from './lib/util';
import { GameScreen, type GameConfig } from './screens/GameScreen';
import { PatientPage } from './screens/PatientPage';
import { ProHome } from './screens/ProHome';
import { SettingsPage } from './screens/SettingsPage';

type View =
  | { name: 'loading' }
  | { name: 'setup' }
  | { name: 'locked'; next: View }
  | { name: 'home' }
  | { name: 'patient'; id: number }
  | { name: 'settings' }
  | { name: 'game'; cfg: GameConfig };

function exitFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });

  useEffect(() => {
    getKV<string>('pinHash').then((h) => setView(h ? { name: 'locked', next: { name: 'home' } } : { name: 'setup' }));
  }, []);

  switch (view.name) {
    case 'loading':
      return null;
    case 'setup':
      return <PinSetup onDone={() => setView({ name: 'home' })} />;
    case 'locked':
      return <Locked onUnlock={() => setView(view.next)} />;
    case 'home':
      return (
        <ProHome
          onOpen={(id) => setView({ name: 'patient', id })}
          onSettings={() => setView({ name: 'settings' })}
          onLock={() => setView({ name: 'locked', next: { name: 'home' } })}
        />
      );
    case 'patient':
      return (
        <PatientPage
          patientId={view.id}
          onBack={() => setView({ name: 'home' })}
          onStart={(cfg) => setView({ name: 'game', cfg })}
        />
      );
    case 'settings':
      return <SettingsPage onBack={() => setView({ name: 'home' })} />;
    case 'game': {
      const back: View = { name: 'patient', id: view.cfg.patient.id! };
      return (
        <GameScreen
          cfg={view.cfg}
          onAbort={() => {
            exitFullscreen();
            setView(back);
          }}
          onFinished={() => setView({ name: 'locked', next: back })}
        />
      );
    }
  }
}

function Locked({ onUnlock }: { onUnlock: () => void }) {
  const [err, setErr] = useState<string>();
  return (
    <div className="lock-screen">
      <PinPad
        title="Área do profissional"
        error={err}
        onSubmit={async (pin) => {
          if (await checkPin(pin)) {
            exitFullscreen();
            onUnlock();
          } else setErr('PIN incorreto');
        }}
      />
    </div>
  );
}

function PinSetup({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string>();
  const [err, setErr] = useState<string>();
  return (
    <div className="lock-screen">
      <div className="setup-intro">
        <h1>Memória Visual</h1>
        <p>Bem-vindo(a)! Crie um PIN de 4 a 8 dígitos. Ele protege a área do profissional e impede que a criança saia do jogo.</p>
        <p className="disclaimer">{DISCLAIMER}</p>
      </div>
      {first === undefined ? (
        <PinPad title="Crie o PIN" error={err} onSubmit={(p) => { setErr(undefined); setFirst(p); }} />
      ) : (
        <PinPad
          title="Confirme o PIN"
          onCancel={() => setFirst(undefined)}
          onSubmit={async (p) => {
            if (p !== first) {
              setFirst(undefined);
              setErr('Os PINs não conferem. Tente de novo.');
              return;
            }
            await setKV('pinHash', hashPin(p));
            onDone();
          }}
        />
      )}
    </div>
  );
}
