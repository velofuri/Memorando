import Dexie, { type Table } from 'dexie';
import type { Patient, Profile, Session } from './types';
import { hashPin } from './util';

export interface KV {
  key: string;
  value: unknown;
}

export const DEFAULT_PROFILES: Profile[] = [
  { name: 'Padrão 8×5s', cardCount: 8, exposureMs: 5000, intervalMs: 3000, difficulty: 'medio', colors: false, trials: 5, delayedRecall: true },
  { name: 'Fácil 4×8s', cardCount: 4, exposureMs: 8000, intervalMs: 3000, difficulty: 'facil', colors: true, trials: 5, delayedRecall: false },
  { name: 'Difícil 8×5s', cardCount: 8, exposureMs: 5000, intervalMs: 3000, difficulty: 'dificil', colors: false, trials: 5, delayedRecall: true },
];

class MemoriaDB extends Dexie {
  patients!: Table<Patient, number>;
  sessions!: Table<Session, number>;
  profiles!: Table<Profile, number>;
  kv!: Table<KV, string>;

  constructor() {
    super('memoria-visual');
    this.version(1).stores({
      patients: '++id, &code',
      sessions: '++id, patientId, mode, startedAt',
      profiles: '++id, name',
      kv: 'key',
    });
    this.on('populate', (tx) => {
      tx.table('profiles').bulkAdd(DEFAULT_PROFILES);
    });
  }
}

export const db = new MemoriaDB();

export async function getKV<T>(key: string): Promise<T | undefined> {
  return (await db.kv.get(key))?.value as T | undefined;
}

export async function setKV(key: string, value: unknown) {
  await db.kv.put({ key, value });
}

export async function checkPin(pin: string): Promise<boolean> {
  return (await getKV<string>('pinHash')) === hashPin(pin);
}
