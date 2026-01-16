import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { HistoryEntry, HistoryStats } from '../types';

interface HistoryState {
  entries: HistoryEntry[];
  stats: HistoryStats | null;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  loadHistory: (limit?: number, offset?: number) => Promise<void>;
  searchHistory: (query: string) => Promise<void>;
  deleteEntry: (id: number) => Promise<void>;
  clearHistory: () => Promise<void>;
  loadStats: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  exportHistory: () => Promise<HistoryEntry[]>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  stats: null,
  loading: false,
  error: null,
  searchQuery: '',

  loadHistory: async (limit = 100, offset = 0) => {
    set({ loading: true, error: null });
    try {
      const entries = await invoke<HistoryEntry[]>('get_history', { limit, offset });
      set({ entries, loading: false });
    } catch (error) {
      console.error('Failed to load history:', error);
      set({ loading: false, error: String(error) });
    }
  },

  searchHistory: async (query: string) => {
    set({ loading: true, error: null, searchQuery: query });
    try {
      if (query.trim()) {
        const entries = await invoke<HistoryEntry[]>('search_history', { query, limit: 100 });
        set({ entries, loading: false });
      } else {
        await get().loadHistory();
      }
    } catch (error) {
      console.error('Failed to search history:', error);
      set({ loading: false, error: String(error) });
    }
  },

  deleteEntry: async (id: number) => {
    try {
      await invoke('delete_history_entry', { id });
      set((state) => ({
        entries: state.entries.filter((e) => e.id !== id),
      }));
      get().loadStats();
    } catch (error) {
      console.error('Failed to delete entry:', error);
      set({ error: String(error) });
    }
  },

  clearHistory: async () => {
    try {
      await invoke('clear_all_history');
      set({ entries: [], stats: { total_entries: 0, total_characters: 0, total_words: 0 } });
    } catch (error) {
      console.error('Failed to clear history:', error);
      set({ error: String(error) });
    }
  },

  loadStats: async () => {
    try {
      const stats = await invoke<HistoryStats>('get_history_stats');
      set({ stats });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  exportHistory: async () => {
    try {
      // Check if export feature is enabled (Pro only)
      const isEnabled = await invoke<boolean>('check_feature_enabled', { feature: 'export_history' });
      if (!isEnabled) {
        throw new Error('Export history is a Pro feature. Please upgrade to access this feature.');
      }
      return await invoke<HistoryEntry[]>('export_all_history');
    } catch (error) {
      console.error('Failed to export history:', error);
      throw error;
    }
  },
}));
