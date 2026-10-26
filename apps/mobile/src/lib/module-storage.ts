import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOST_STORAGE_KEY, type HostStorage } from '@erre/core/client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Device storage handed to module UIs (ModuleHost.storage / secureStorage). Web: localStorage for both (it may
// be blocked: then reads are empty and writes are dropped). Native: AsyncStorage and the secure store.

function checkKey(key: string) {
  if (!HOST_STORAGE_KEY.test(key)) throw new Error(`invalid storage key: ${key}`);
}

const webStorage: HostStorage = {
  async getItem(key) {
    checkKey(key);
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    checkKey(key);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // blocked or full: lasts for this session only
    }
  },
  async removeItem(key) {
    checkKey(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // blocked
    }
  },
};

const asyncStorage: HostStorage = {
  async getItem(key) {
    checkKey(key);
    return AsyncStorage.getItem(key).catch(() => null);
  },
  async setItem(key, value) {
    checkKey(key);
    await AsyncStorage.setItem(key, value).catch(() => undefined);
  },
  async removeItem(key) {
    checkKey(key);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

const secureStore: HostStorage = {
  async getItem(key) {
    checkKey(key);
    return SecureStore.getItemAsync(key).catch(() => null);
  },
  async setItem(key, value) {
    checkKey(key);
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key) {
    checkKey(key);
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

const isWeb = Platform.OS === 'web';

export const moduleStorage: HostStorage = isWeb ? webStorage : asyncStorage;
export const moduleSecureStorage: HostStorage = isWeb ? webStorage : secureStore;
