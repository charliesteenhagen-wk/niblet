import { useState, useEffect, useRef } from 'react';
import { useSnippets } from '../hooks/useSnippets';
import { useEditorStore } from '../stores/editorStore';
import type { Snippet } from '../types';

export function SnippetsPanel() {
  const {
    snippets,
    loading,
    searchQuery,
    editingSnippet,
    setEditingSnippet,
    handleSearch,
    handleInsert,
    handleSaveCurrentAsSnippet,
    handleUpdate,
    handleDelete,
  } = useSnippets();
  const { setActivePanel, content } = useEditorStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset selection when snippets change
  useEffect(() => {
    setSelectedIndex(0);
  }, [snippets]);

  // Handle keyboard navigation
  useEffect(() => {
    // Don't handle keyboard when creating or editing
    if (isCreating || editingSnippet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow keys always work for navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.min(prev + 1, snippets.length - 1));
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
        if (snippets[selectedIndex]) {
          handleInsert(snippets[selectedIndex]);
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
  }, [snippets, selectedIndex, handleInsert, isCreating, editingSnippet]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const startCreating = () => {
    setNewSnippetContent(content); // Pre-fill with editor content if any
    setIsCreating(true);
  };

  const handleCreate = async () => {
    if (!newSnippetName.trim() || !newSnippetContent.trim()) return;
    await handleSaveCurrentAsSnippet(newSnippetName.trim(), newSnippetContent.trim());
    setNewSnippetName('');
    setNewSnippetContent('');
    setIsCreating(false);
  };

  const cancelCreate = () => {
    setNewSnippetName('');
    setNewSnippetContent('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-lg font-semibold">Snippets</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={startCreating}
            className="btn btn-primary text-xs"
          >
            + New
          </button>
          <button
            onClick={() => setActivePanel('editor')}
            className="btn"
            aria-label="Close snippets"
          >
            ✕
          </button>
        </div>
      </div>

      {isCreating && (
        <div className="px-4 py-3 border-b border-[var(--editor-border)] bg-[var(--editor-surface)]">
          <p className="text-xs text-[var(--editor-muted)] mb-2">Create new snippet:</p>
          <input
            type="text"
            value={newSnippetName}
            onChange={(e) => setNewSnippetName(e.target.value)}
            placeholder="Snippet name..."
            className="input mb-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <textarea
            value={newSnippetContent}
            onChange={(e) => setNewSnippetContent(e.target.value)}
            placeholder="Snippet content..."
            className="input min-h-[80px] resize-y mb-2"
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="btn btn-primary"
              disabled={!newSnippetName.trim() || !newSnippetContent.trim()}
            >
              Save
            </button>
            <button onClick={cancelCreate} className="btn">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-2 border-b border-[var(--editor-border)]">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search snippets... (just start typing)"
          className="input"
        />
      </div>

      <div className="flex-1 overflow-auto" ref={listRef}>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[var(--editor-muted)]">
            Loading...
          </div>
        ) : snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-[var(--editor-muted)]">
            <p>No snippets yet</p>
            <p className="text-xs mt-1">Create snippets to reuse text</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--editor-border)]">
            {snippets.map((snippet, index) => (
              <SnippetItem
                key={snippet.id}
                snippet={snippet}
                index={index}
                isSelected={index === selectedIndex}
                isEditing={editingSnippet?.id === snippet.id}
                onInsert={handleInsert}
                onEdit={() => setEditingSnippet(snippet)}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCancelEdit={() => setEditingSnippet(null)}
                onHover={() => setSelectedIndex(index)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-b-xl text-xs text-[var(--editor-muted)] flex justify-between">
        <span>{snippets.length} snippets</span>
        <span className="opacity-60">↑↓ navigate · Enter select</span>
      </div>
    </div>
  );
}

interface SnippetItemProps {
  snippet: Snippet;
  index: number;
  isSelected: boolean;
  isEditing: boolean;
  onInsert: (snippet: Snippet) => void;
  onEdit: () => void;
  onUpdate: (id: string, name: string, content: string, tags: string[]) => void;
  onDelete: (id: string, e?: React.MouseEvent) => void;
  onCancelEdit: () => void;
  onHover: () => void;
}

function SnippetItem({
  snippet,
  index,
  isSelected,
  isEditing,
  onInsert,
  onEdit,
  onUpdate,
  onDelete,
  onCancelEdit,
  onHover,
}: SnippetItemProps) {
  const [editName, setEditName] = useState(snippet.name);
  const [editContent, setEditContent] = useState(snippet.content);

  if (isEditing) {
    return (
      <div className="p-3 bg-[var(--editor-surface)]" data-index={index}>
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          placeholder="Snippet name..."
          className="input mb-2"
          autoFocus
        />
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="input min-h-[80px] resize-y"
          placeholder="Snippet content..."
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => onUpdate(snippet.id, editName, editContent, snippet.tags)}
            className="btn btn-primary text-xs"
          >
            Save
          </button>
          <button onClick={onCancelEdit} className="btn text-xs">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-index={index}
      className={`list-item group ${isSelected ? 'selected' : ''}`}
      onClick={() => onInsert(snippet)}
      onMouseEnter={onHover}
      role="button"
      tabIndex={-1}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{snippet.name}</p>
          <p className="text-xs text-[var(--editor-muted)] truncate mt-1">
            {snippet.content.split('\n')[0]}
          </p>
          {snippet.tags.length > 0 && (
            <div className="flex gap-1 mt-1">
              {snippet.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-xs rounded bg-[var(--editor-hover)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 hover:text-[var(--editor-accent)]"
            aria-label="Edit snippet"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => onDelete(snippet.id, e)}
            className="p-1 hover:text-red-400"
            aria-label="Delete snippet"
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
    </div>
  );
}
