import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StoredTvCredential } from '../types/remote';

const STORAGE_KEY = 'tvremote.pairedDevices.v1';
const LAST_HOST_KEY = 'tvremote.lastConnectedHost.v1';
const MULTI_SCREEN_PACKAGE_KEY = 'tvremote.multiScreenPackage.v1';
const FILE_MANAGER_PACKAGE_KEY = 'tvremote.fileManagerPackage.v1';

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

    const lastHost = await AsyncStorage.getItem(LAST_HOST_KEY);
    if (lastHost === host) {
      await AsyncStorage.removeItem(LAST_HOST_KEY);
    }
  },

  async getLastHost(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_HOST_KEY);
  },

  async setLastHost(host: string): Promise<void> {
    await AsyncStorage.setItem(LAST_HOST_KEY, host);
  },

  async getMultiScreenPackage(): Promise<string | null> {
    return AsyncStorage.getItem(MULTI_SCREEN_PACKAGE_KEY);
  },

  async setMultiScreenPackage(packageName: string): Promise<void> {
    await AsyncStorage.setItem(MULTI_SCREEN_PACKAGE_KEY, packageName.trim());
  },

  async getFileManagerPackage(): Promise<string | null> {
    return AsyncStorage.getItem(FILE_MANAGER_PACKAGE_KEY);
  },

  async setFileManagerPackage(packageName: string): Promise<void> {
    await AsyncStorage.setItem(FILE_MANAGER_PACKAGE_KEY, packageName.trim());
  },
};
