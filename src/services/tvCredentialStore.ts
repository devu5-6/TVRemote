import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredTvCredential } from '../types/remote';

const STORAGE_KEY = 'tvremote.pairedDevices.v1';

const sanitizeHost = (host: string) => host.replace(/[^a-zA-Z0-9._-]/g, '_');

async function readAll(): Promise<Record<string, StoredTvCredential>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, StoredTvCredential>;
  } catch {
    return {};
  }
}

async function writeAll(data: Record<string, StoredTvCredential>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const tvCredentialStore = {
  async getAll(): Promise<StoredTvCredential[]> {
    const data = await readAll();
    return Object.values(data);
  },

  async get(host: string): Promise<StoredTvCredential | null> {
    const data = await readAll();
    return data[sanitizeHost(host)] ?? null;
  },

  async save(credential: StoredTvCredential): Promise<void> {
    const data = await readAll();
    data[sanitizeHost(credential.host)] = credential;
    await writeAll(data);
  },

  async remove(host: string): Promise<void> {
    const data = await readAll();
    delete data[sanitizeHost(host)];
    await writeAll(data);
  },
};
