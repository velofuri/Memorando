import { db, setKV } from './db';
import { download } from './util';

const FORMAT = 'memoria-visual-backup';

export async function exportBackup() {
  const data = {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    patients: await db.patients.toArray(),
    sessions: await db.sessions.toArray(),
    profiles: await db.profiles.toArray(),
  };
  download(
    `backup_memoria_${data.exportedAt.slice(0, 10)}.json`,
    new Blob([JSON.stringify(data)], { type: 'application/json' }),
  );
  await setKV('lastBackupAt', Date.now());
}

/** Substitui todos os pacientes, sessões e perfis pelos do arquivo. O PIN é mantido. */
export async function importBackup(file: File): Promise<{ patients: number; sessions: number }> {
  const data = JSON.parse(await file.text());
  if (data?.format !== FORMAT || !Array.isArray(data.patients) || !Array.isArray(data.sessions)) {
    throw new Error('Arquivo não é um backup válido deste aplicativo.');
  }
  await db.transaction('rw', db.patients, db.sessions, db.profiles, async () => {
    await db.patients.clear();
    await db.sessions.clear();
    await db.patients.bulkAdd(data.patients);
    await db.sessions.bulkAdd(data.sessions);
    if (Array.isArray(data.profiles) && data.profiles.length) {
      await db.profiles.clear();
      await db.profiles.bulkAdd(data.profiles);
    }
  });
  return { patients: data.patients.length, sessions: data.sessions.length };
}
