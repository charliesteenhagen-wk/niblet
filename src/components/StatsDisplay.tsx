import { useEditorStore } from '../stores/editorStore';

export function StatsDisplay() {
  const { stats } = useEditorStore();

  return (
    <div className="flex items-center gap-4 text-xs text-[var(--editor-muted)]">
      <span title="Characters">{stats.character_count} chars</span>
      <span title="Words">{stats.word_count} words</span>
      <span title="Lines">{stats.line_count} lines</span>
      {stats.paragraph_count > 0 && (
        <span title="Paragraphs">{stats.paragraph_count} paragraphs</span>
      )}
    </div>
  );
}
