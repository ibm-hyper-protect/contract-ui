import { create } from 'zustand';

const DEFAULT_SERVER_URL = 'http://localhost:8080';
const normalizeServerUrl = (url = '') => String(url).trim().replace(/\/+$/, '');

const emitServerConfigChanged = (serverUrl) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('server-config:changed', {
      detail: {
        serverUrl
      }
    }));
  }
};

const emitServerConnectionChanged = (connectionStatus, lastConnectionTest) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('server-connection:changed', {
      detail: {
        connectionStatus,
        lastConnectionTest
      }
    }));
  }
};

const persistAppConfig = async (updates = {}) => {
  if (typeof window === 'undefined' || !window.electron?.appConfig?.write) {
    return null;
  }
  return window.electron.appConfig.write(updates);
};

export const useConfigStore = create((set, get) => ({
  // State
  serverUrl: DEFAULT_SERVER_URL,
  isServerConfigured: false,
  lastConnectionTest: null,
  connectionStatus: 'unknown', // 'unknown' | 'connected' | 'failed'
  configLoaded: false,
  configFilePath: '',

  hydrateConfig: async () => {
    if (typeof window === 'undefined' || !window.electron?.appConfig?.read) {
      set({ configLoaded: true });
      return;
    }

    try {
      const config = await window.electron.appConfig.read();
      const normalizedUrl = normalizeServerUrl(config?.serverUrl) || DEFAULT_SERVER_URL;
      set({
        serverUrl: normalizedUrl,
        isServerConfigured: normalizedUrl !== DEFAULT_SERVER_URL,
        configLoaded: true,
        configFilePath: config?.configFilePath || ''
      });
      emitServerConfigChanged(normalizedUrl);
    } catch (error) {
      console.error('Failed to hydrate app config:', error);
      set({ configLoaded: true });
    }
  },

  setServerUrl: async (url) => {
    const normalizedUrl = normalizeServerUrl(url) || DEFAULT_SERVER_URL;
    set({
      serverUrl: normalizedUrl,
      isServerConfigured: normalizedUrl !== DEFAULT_SERVER_URL || Boolean(url)
    });

    emitServerConfigChanged(normalizedUrl);

    try {
      const persistedConfig = await persistAppConfig({ serverUrl: normalizedUrl });
      if (persistedConfig?.configFilePath) {
        set({ configFilePath: persistedConfig.configFilePath });
      }
    } catch (error) {
      console.error('Failed to persist server URL:', error);
    }
  },

  setConnectionStatus: (status, timestamp = new Date().toISOString()) => {
    set({
      connectionStatus: status,
      lastConnectionTest: timestamp
    });

    emitServerConnectionChanged(status, timestamp);
  },

  resetServerConfig: async () => {
    set({
      serverUrl: DEFAULT_SERVER_URL,
      isServerConfigured: false,
      lastConnectionTest: null,
      connectionStatus: 'unknown'
    });

    emitServerConfigChanged(DEFAULT_SERVER_URL);
    emitServerConnectionChanged('unknown', null);

    try {
      const persistedConfig = await persistAppConfig({ serverUrl: DEFAULT_SERVER_URL });
      if (persistedConfig?.configFilePath) {
        set({ configFilePath: persistedConfig.configFilePath });
      }
    } catch (error) {
      console.error('Failed to reset persisted server URL:', error);
    }
  },

  applyExternalConfig: (config = {}) => {
    const normalizedUrl = normalizeServerUrl(config?.serverUrl) || DEFAULT_SERVER_URL;
    set({
      serverUrl: normalizedUrl,
      isServerConfigured: normalizedUrl !== DEFAULT_SERVER_URL,
      configLoaded: true,
      configFilePath: config?.configFilePath || get().configFilePath
    });
    emitServerConfigChanged(normalizedUrl);
  },

  // Computed
  isConnected: () => {
    const state = get();
    return state.connectionStatus === 'connected';
  },

  needsConfiguration: () => {
    const state = get();
    return !state.isServerConfigured || state.connectionStatus === 'failed';
  }
}));


