import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../stores/editorStore';
import type { ClipboardEntry } from '../types';

export function ClipboardPanel() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { setActivePanel, setContent, content } = useEditorStore();
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load clipboard history
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<ClipboardEntry[]>('get_clipboard_history', { limit: 100 });
      setEntries(result);
    } catch (error) {
      console.error('Failed to load clipboard history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search clipboard history
  const searchHistory = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadHistory();
      return;
    }
    setLoading(true);
    try {
      const result = await invoke<ClipboardEntry[]>('search_clipboard_history', {
        query,
        limit: 100,
      });
      setEntries(result);
    } catch (error) {
      console.error('Failed to search clipboard history:', error);
    } finally {
      setLoading(false);
    }
  }, [loadHistory]);

  // Initial load
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchHistory(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchHistory]);

  // Reset selection when entries change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries]);

  // Handle selecting an entry - insert at cursor or append
  const handleSelect = useCallback((entry: ClipboardEntry) => {
    // Insert the clipboard content into the editor
    const newContent = content ? `${content}\n${entry.content}` : entry.content;
    setContent(newContent);
    setActivePanel('editor');
  }, [content, setContent, setActivePanel]);

  // Handle delete
  const handleDelete = useCallback(async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke('delete_clipboard_item', { id });
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.error('Failed to delete clipboard entry:', error);
    }
  }, []);

  // Handle clear all
  const handleClearAll = useCallback(async () => {
    if (!confirm('Clear all clipboard history?')) return;
    try {
      await invoke('clear_clipboard_history_cmd');
      setEntries([]);
    } catch (error) {
      console.error('Failed to clear clipboard history:', error);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        if (entries[selectedIndex]) {
          handleSelect(entries[selectedIndex]);
        }
        return;
      }

      // Start typing to focus search
      if (document.activeElement !== searchInputRef.current && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [entries, selectedIndex, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-lg font-semibold">Clipboard History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAll}
            disabled={entries.length === 0}
            className="btn text-xs disabled:opacity-50"
            aria-label="Clear clipboard history"
            title="Clear all clipboard history"
          >
            Clear
          </button>
          <button
            onClick={() => setActivePanel('editor')}
            className="btn"
            aria-label="Close clipboard history"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[var(--editor-border)]">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search clipboard... (just start typing)"
          className="input"
        />
      </div>

      <div className="flex-1 overflow-auto" ref={listRef}>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--editor-muted)]">
            Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--editor-muted)]">
            <p>No clipboard history</p>
            <p className="text-xs mt-1">Copy something to see it here</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--editor-border)]">
            {entries.map((entry, index) => (
              <ClipboardItem
                key={entry.id}
                entry={entry}
                index={index}
                isSelected={index === selectedIndex}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onHover={() => setSelectedIndex(index)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-b-xl text-xs text-[var(--editor-muted)] flex justify-between">
        <span>{entries.length} items</span>
        <span className="opacity-60">↑↓ navigate · Enter insert</span>
      </div>
    </div>
  );
}

interface ClipboardItemProps {
  entry: ClipboardEntry;
  index: number;
  isSelected: boolean;
  onSelect: (entry: ClipboardEntry) => void;
  onDelete: (id: number, e?: React.MouseEvent) => void;
  onHover: () => void;
  formatDate: (date: string) => string;
}

function ClipboardItem({ entry, index, isSelected, onSelect, onDelete, onHover, formatDate }: ClipboardItemProps) {
  return (
    <div
      data-index={index}
      className={`list-item group ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(entry)}
      onMouseEnter={onHover}
      role="button"
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate font-mono">{entry.preview}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--editor-muted)]">
            <span>{formatDate(entry.created_at)}</span>
            <span>·</span>
            <span>{entry.char_count} chars</span>
          </div>
        </div>
        <button
          onClick={(e) => onDelete(entry.id, e)}
          className={`p-1 hover:text-red-400 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}
          aria-label="Delete entry"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
