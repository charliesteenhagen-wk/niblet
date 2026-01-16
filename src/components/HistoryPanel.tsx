import { useState, useEffect, useRef } from 'react';
import { useHistory } from '../hooks/useHistory';
import { useEditorStore } from '../stores/editorStore';
import { useHistoryStore } from '../stores/historyStore';
import type { HistoryEntry } from '../types';

export function HistoryPanel() {
  const { entries, loading, searchQuery, handleSearch, handleSelect, handleDelete } = useHistory();
  const { setActivePanel } = useEditorStore();
  const { exportHistory } = useHistoryStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const historyData = await exportHistory();
      const json = JSON.stringify(historyData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `niblet-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  // Reset selection when entries change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys always work for navigation
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

      // Enter to select - works even when search is focused
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

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
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

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-lg font-semibold">History</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || entries.length === 0}
            className="btn text-xs disabled:opacity-50"
            aria-label="Export history"
            title="Export history to JSON"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            onClick={() => setActivePanel('editor')}
            className="btn"
            aria-label="Close history"
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
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search history... (just start typing)"
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
            <p>No history yet</p>
            <p className="text-xs mt-1">Your drafts will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--editor-border)]">
            {entries.map((entry, index) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                index={index}
                isSelected={index === selectedIndex}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onHover={() => setSelectedIndex(index)}
                formatDate={formatDate}
                truncate={truncate}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-b-xl text-xs text-[var(--editor-muted)] flex justify-between">
        <span>{entries.length} entries</span>
        <span className="opacity-60">↑↓ navigate · Enter select</span>
      </div>
    </div>
  );
}

interface HistoryItemProps {
  entry: HistoryEntry;
  index: number;
  isSelected: boolean;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: number, e?: React.MouseEvent) => void;
  onHover: () => void;
  formatDate: (date: string) => string;
  truncate: (text: string, length: number) => string;
}

function HistoryItem({ entry, index, isSelected, onSelect, onDelete, onHover, formatDate, truncate }: HistoryItemProps) {
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
          <p className="text-sm truncate">{truncate(entry.content.split('\n')[0], 50)}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-[var(--editor-muted)]">
            <span>{formatDate(entry.created_at)}</span>
            <span>·</span>
            <span>{entry.word_count} words</span>
            {entry.language && entry.language !== 'plaintext' && (
              <>
                <span>·</span>
                <span>{entry.language}</span>
              </>
            )}
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
