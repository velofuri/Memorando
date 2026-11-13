import { useState } from 'react';

interface Props {
  title: string;
  error?: string;
  onSubmit: (pin: string) => void;
  onCancel?: () => void;
}

export function PinPad({ title, error, onSubmit, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const press = (d: string) => setPin((p) => (p.length < 8 ? p + d : p));
  const submit = () => {
    if (pin.length >= 4) {
      onSubmit(pin);
      setPin('');
    }
  };

  return (
    <div className="pinpad">
      <h2>{title}</h2>
      <div className="pin-dots" aria-label={`${pin.length} dígitos`}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? 'on' : ''} />
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="pin-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>{d}</button>
        ))}
        <button type="button" className="muted" onClick={() => setPin((p) => p.slice(0, -1))}>⌫</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" className="primary" disabled={pin.length < 4} onClick={submit}>OK</button>
      </div>
      {onCancel && (
        <button type="button" className="link" onClick={onCancel}>Cancelar</button>
      )}
    </div>
  );
}
