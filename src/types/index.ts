export interface WindowPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ThemeType = 'dark' | 'light' | 'high-contrast' | 'solarized-dark' | 'solarized-light' | 'dracula' | 'nord';

export interface AppSettings {
  hotkey: string;
  theme: ThemeType;
  font_family: string;
  font_size: number;
  opacity: number;
  tab_size: number;
  line_wrap: boolean;
  line_numbers: boolean;
  show_status_bar: boolean;
  max_history_entries: number;
  auto_save_drafts: boolean;
  launch_at_login: boolean;
  default_language: string;
  window_position: WindowPosition;
}

export interface HistoryEntry {
  id: number;
  content: string;
  created_at: string;
  character_count: number;
  word_count: number;
  line_count: number;
  language: string | null;
  tags: string | null;
}

export interface HistoryStats {
  total_entries: number;
  total_characters: number;
  total_words: number;
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SnippetsData {
  snippets: Snippet[];
}

export interface TextStats {
  character_count: number;
  word_count: number;
  line_count: number;
  paragraph_count: number;
}

export type TextTransform =
  | 'uppercase'
  | 'lowercase'
  | 'titlecase'
  | 'sentencecase'
  | 'trim'
  | 'sort'
  | 'deduplicate'
  | 'reverse';

export type PanelType = 'editor' | 'settings' | 'history' | 'snippets' | 'actions';
