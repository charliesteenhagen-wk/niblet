import { useEffect, useCallback, useState } from 'react';
import { useSnippetsStore } from '../stores/snippetsStore';
import { useEditorStore } from '../stores/editorStore';
import type { Snippet } from '../types';

export function useSnippets() {
  const {
    snippets,
    loading,
    searchQuery,
    loadSnippets,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    setSearchQuery,
    getFilteredSnippets,
  } = useSnippetsStore();
  const { content, setContent, setActivePanel } = useEditorStore();
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery]
  );

  const handleInsert = useCallback(
    (snippet: Snippet) => {
      setContent(content + snippet.content);
      setActivePanel('editor');
    },
    [content, setContent, setActivePanel]
  );

  const handleSaveCurrentAsSnippet = useCallback(
    async (name: string, snippetContent?: string, tags: string[] = []) => {
      const contentToSave = snippetContent ?? content;
      if (!contentToSave.trim()) return null;
      return await addSnippet(name, contentToSave, tags);
    },
    [content, addSnippet]
  );

  const handleUpdate = useCallback(
    async (id: string, name: string, snippetContent: string, tags: string[]) => {
      await updateSnippet(id, name, snippetContent, tags);
      setEditingSnippet(null);
    },
    [updateSnippet]
  );

  const handleDelete = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      await deleteSnippet(id);
    },
    [deleteSnippet]
  );

  return {
    snippets: getFilteredSnippets(),
    allSnippets: snippets,
    loading,
    searchQuery,
    editingSnippet,
    setEditingSnippet,
    handleSearch,
    handleInsert,
    handleSaveCurrentAsSnippet,
    handleUpdate,
    handleDelete,
  };
}
