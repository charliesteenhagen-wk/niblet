import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { Snippet, SnippetsData } from '../types';

interface SnippetsState {
  snippets: Snippet[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  loadSnippets: () => Promise<void>;
  addSnippet: (name: string, content: string, tags?: string[]) => Promise<Snippet | null>;
  updateSnippet: (id: string, name: string, content: string, tags: string[]) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFilteredSnippets: () => Snippet[];
  exportSnippets: () => SnippetsData;
  importSnippets: (data: SnippetsData) => Promise<void>;
}

export const useSnippetsStore = create<SnippetsState>((set, get) => ({
  snippets: [],
  loading: false,
  error: null,
  searchQuery: '',

  loadSnippets: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<SnippetsData>('get_snippets');
      set({ snippets: data.snippets, loading: false });
    } catch (error) {
      console.error('Failed to load snippets:', error);
      set({ loading: false, error: String(error) });
    }
  },

  addSnippet: async (name: string, content: string, tags: string[] = []) => {
    try {
      const snippet = await invoke<Snippet>('add_snippet', { name, content, tags });
      set((state) => ({
        snippets: [...state.snippets, snippet],
      }));
      return snippet;
    } catch (error) {
      console.error('Failed to add snippet:', error);
      set({ error: String(error) });
      return null;
    }
  },

  updateSnippet: async (id: string, name: string, content: string, tags: string[]) => {
    try {
      await invoke('update_snippet', { id, name, content, tags });
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id ? { ...s, name, content, tags, updated_at: new Date().toISOString() } : s
        ),
      }));
    } catch (error) {
      console.error('Failed to update snippet:', error);
      set({ error: String(error) });
    }
  },

  deleteSnippet: async (id: string) => {
    try {
      await invoke('delete_snippet', { id });
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete snippet:', error);
      set({ error: String(error) });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFilteredSnippets: () => {
    const { snippets, searchQuery } = get();
    if (!searchQuery.trim()) return snippets;

    const query = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query))
    );
  },

  exportSnippets: () => {
    return { snippets: get().snippets };
  },

  importSnippets: async (data: SnippetsData) => {
    try {
      await invoke('save_snippets_data', { data });
      set({ snippets: data.snippets });
    } catch (error) {
      console.error('Failed to import snippets:', error);
      set({ error: String(error) });
    }
  },
}));
