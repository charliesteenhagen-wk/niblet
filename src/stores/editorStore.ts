import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { TextStats, PanelType } from '../types';

interface EditorState {
  content: string;
  language: string;
  stats: TextStats;
  activePanel: PanelType;
  isVisible: boolean;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
  setActivePanel: (panel: PanelType) => void;
  updateStats: () => Promise<void>;
  pasteAndClose: () => Promise<void>;
  closeWithoutPaste: () => Promise<void>;
  clearContent: () => void;
  transformText: (transform: string) => Promise<void>;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  language: 'plaintext',
  stats: { character_count: 0, word_count: 0, line_count: 0, paragraph_count: 0 },
  activePanel: 'editor',
  isVisible: false,

  setContent: (content: string) => {
    set({ content });
    get().updateStats();
  },

  setLanguage: (language: string) => {
    set({ language });
  },

  setActivePanel: (panel: PanelType) => {
    set({ activePanel: panel });
  },

  updateStats: async () => {
    const { content } = get();
    try {
      const stats = await invoke<TextStats>('get_text_stats', { text: content });
      set({ stats });
    } catch (error) {
      // Calculate locally if backend fails
      const character_count = content.length;
      const word_count = content.split(/\s+/).filter(Boolean).length;
      const line_count = content.split('\n').length;
      const paragraph_count = content.split(/\n\n+/).filter(Boolean).length;
      set({ stats: { character_count, word_count, line_count, paragraph_count } });
    }
  },

  pasteAndClose: async () => {
    const { content } = get();
    if (content.trim()) {
      try {
        // Write to clipboard
        await writeText(content);

        // Save to history
        await invoke('add_history_entry', {
          content,
          language: get().language,
          tags: null,
        });

        // Hide window and auto-paste to previous app
        await invoke('hide_and_paste');
        set({ content: '', activePanel: 'editor', isVisible: false });
        return;
      } catch (error) {
        console.error('Failed to paste:', error);
      }
    }
    get().hideWindow();
    set({ content: '', activePanel: 'editor' });
  },

  closeWithoutPaste: async () => {
    await get().hideWindow();
    // Keep the content - only reset panel, don't clear text
    set({ activePanel: 'editor' });
  },

  clearContent: () => {
    set({ content: '' });
    get().updateStats();
  },

  transformText: async (transform: string) => {
    const { content } = get();
    try {
      const transformed = await invoke<string>('transform_text_cmd', { text: content, transform });
      set({ content: transformed });
      get().updateStats();
    } catch (error) {
      console.error('Failed to transform text:', error);
    }
  },

  showWindow: async () => {
    try {
      // Use Rust command to show window (this also stores the previous app)
      await invoke('show_window');
      set({ isVisible: true });
    } catch (error) {
      console.error('Failed to show window:', error);
    }
  },

  hideWindow: async () => {
    try {
      const window = getCurrentWindow();
      await window.hide();
      set({ isVisible: false });
    } catch (error) {
      console.error('Failed to hide window:', error);
    }
  },
}));
