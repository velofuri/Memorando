export function ageMonths(birthDate: string, at: number): number {
  const b = new Date(birthDate + 'T00:00:00');
  const d = new Date(at);
  let m = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth());
  if (d.getDate() < b.getDate()) m--;
  return Math.max(0, m);
}

export const fmtAge = (m: number) => `${Math.floor(m / 12)}a ${m % 12}m`;
export const fmtDate = (t: number) => new Date(t).toLocaleDateString('pt-BR');
export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function mean(xs: number[]): number | undefined {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
}

/**
 * Hash simples do PIN. O PIN só impede a criança de sair do jogo ou ver resultados;
 * não é proteção criptográfica dos dados.
 */
export function hashPin(pin: string): string {
  let h = 0x811c9dc5;
  for (const ch of 'memoria-visual:' + pin) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

export function download(filename: string, content: Blob) {
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const DISCLAIMER =
  'Ferramenta de apoio, rastreio e estimulação cognitiva. Não é um teste psicológico ' +
  'aprovado pelo SATEPSI/CFP e não deve ser usada isoladamente para diagnóstico ou laudo.';
