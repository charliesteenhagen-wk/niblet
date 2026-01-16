import { useEffect, useCallback } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { useEditorStore } from '../stores/editorStore';

export function useHistory() {
  const { entries, loading, searchQuery, loadHistory, searchHistory, deleteEntry, setSearchQuery } =
    useHistoryStore();
  const { setContent, setActivePanel } = useEditorStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      searchHistory(query);
    },
    [setSearchQuery, searchHistory]
  );

  const handleSelect = useCallback(
    (entry: { content: string }) => {
      setContent(entry.content);
      setActivePanel('editor');
    },
    [setContent, setActivePanel]
  );

  const handleDelete = useCallback(
    async (id: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      await deleteEntry(id);
    },
    [deleteEntry]
  );

  return {
    entries,
    loading,
    searchQuery,
    handleSearch,
    handleSelect,
    handleDelete,
  };
}
