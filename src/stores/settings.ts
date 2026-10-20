import { create } from 'zustand';
import { ipc } from '../lib/ipc';
import { SETTINGS_DEFAULTS, type Settings, type SettingsKey } from '../../shared/settings';

interface SettingsStore {
  hydrated: boolean;
  settings: Settings;
  systemIsDark: boolean;
  init: () => Promise<void>;
  setSetting: (key: SettingsKey, value: Settings[SettingsKey]) => void;
}

let initialized = false;

export const useSettings = create<SettingsStore>((set) => ({
  hydrated: false,
  settings: SETTINGS_DEFAULTS,
  systemIsDark: window.matchMedia('(prefers-color-scheme: dark)').matches,

  init: async () => {
    if (initialized) return;
    initialized = true;

    ipc.on('settings:changed', ({ key, value }) => {
      if (key in SETTINGS_DEFAULTS) {
        set((prev) => ({ settings: { ...prev.settings, [key]: value } }));
      }
    });
    ipc.on('theme:systemChanged', ({ isDark }) => set({ systemIsDark: isDark }));

    const stored = await ipc.invoke('settings:get');
    set({ settings: { ...SETTINGS_DEFAULTS, ...stored }, hydrated: true });
  },

  setSetting: (key, value) => {
    void ipc.invoke('settings:set', [key, value]);
  },
}));
