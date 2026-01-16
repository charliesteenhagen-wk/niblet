import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types';

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  hotkey: navigator.platform.includes('Mac') ? 'Command+Shift+Space' : 'Control+Shift+Space',
  theme: 'dark',
  font_family: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  font_size: 14,
  opacity: 0.95,
  tab_size: 4,
  line_wrap: true,
  line_numbers: false,
  show_status_bar: true,
  max_history_entries: 100,
  auto_save_drafts: true,
  launch_at_login: false,
  default_language: 'plaintext',
  window_position: { x: 100, y: 100, width: 650, height: 450 },
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings, // Start with defaults immediately
  loading: false,
  error: null,

  loadSettings: async () => {
    // Don't set loading to true - we already have defaults
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, loading: false, error: null });
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Keep using defaults, just log the error
      set({ error: String(error) });
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    const current = get().settings || defaultSettings;
    const updated = { ...current, ...newSettings };

    set({ settings: updated });

    try {
      await invoke('update_settings', { settings: updated });
    } catch (error) {
      console.error('Failed to save settings:', error);
      set({ error: String(error) });
    }
  },

  resetToDefaults: async () => {
    set({ settings: defaultSettings });
    try {
      await invoke('update_settings', { settings: defaultSettings });
    } catch (error) {
      console.error('Failed to reset settings:', error);
      set({ error: String(error) });
    }
  },
}));
