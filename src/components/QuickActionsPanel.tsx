import { useEditorStore } from '../stores/editorStore';

const actions = [
  { id: 'uppercase', label: 'UPPERCASE', description: 'Convert to uppercase' },
  { id: 'lowercase', label: 'lowercase', description: 'Convert to lowercase' },
  { id: 'titlecase', label: 'Title Case', description: 'Capitalize each word' },
  { id: 'sentencecase', label: 'Sentence case', description: 'Capitalize first letter of sentences' },
  { id: 'trim', label: 'Trim Whitespace', description: 'Remove leading/trailing spaces' },
  { id: 'sort', label: 'Sort Lines', description: 'Sort lines alphabetically' },
  { id: 'deduplicate', label: 'Remove Duplicates', description: 'Remove duplicate lines' },
  { id: 'reverse', label: 'Reverse Lines', description: 'Reverse line order' },
];

export function QuickActionsPanel() {
  const { setActivePanel, transformText, content } = useEditorStore();

  const handleAction = async (actionId: string) => {
    await transformText(actionId);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <button
          onClick={() => setActivePanel('editor')}
          className="btn"
          aria-label="Close quick actions"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {content.trim() ? (
          <div className="grid gap-2">
            {actions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleAction(action.id)}
                className="list-item text-left"
              >
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-xs text-[var(--editor-muted)]">{action.description}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[var(--editor-muted)]">
            <p>No text to transform</p>
            <p className="text-xs mt-1">Type something first</p>
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-br-xl text-xs text-[var(--editor-muted)]">
        <div className="flex items-center gap-2">
          <span className="kbd">⌘⇧U</span>
          <span>Uppercase</span>
          <span className="kbd">⌘⇧L</span>
          <span>Lowercase</span>
        </div>
      </div>
    </div>
  );
}
