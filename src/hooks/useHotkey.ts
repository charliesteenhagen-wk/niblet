import { useEffect, useCallback } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';

export function useGlobalHotkey() {
  const { settings } = useSettingsStore();
  const { showWindow, isVisible, hideWindow } = useEditorStore();

  const toggleWindow = useCallback(async () => {
    if (isVisible) {
      await hideWindow();
    } else {
      await showWindow();
    }
  }, [isVisible, showWindow, hideWindow]);

  useEffect(() => {
    if (!settings?.hotkey) return;

    const shortcut = settings.hotkey;
    let registered = false;

    const setupHotkey = async () => {
      try {
        // Check if already registered
        const alreadyRegistered = await isRegistered(shortcut);
        if (alreadyRegistered) {
          await unregister(shortcut);
        }

        // Register the hotkey
        await register(shortcut, (event) => {
          if (event.state === 'Pressed') {
            toggleWindow();
          }
        });
        registered = true;
        console.log(`Hotkey registered: ${shortcut}`);
      } catch (error) {
        console.error('Failed to register hotkey:', error);
      }
    };

    setupHotkey();

    return () => {
      if (registered) {
        unregister(shortcut).catch(console.error);
      }
    };
  }, [settings?.hotkey, toggleWindow]);
}

export function useKeyboardShortcuts() {
  const { pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape - if in a panel, go back to editor; if in editor, close window
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activePanel !== 'editor') {
          setActivePanel('editor');
        } else {
          closeWithoutPaste();
        }
        return;
      }

      // Cmd/Ctrl + Enter - paste and close
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        pasteAndClose();
        return;
      }

      // Cmd/Ctrl + , - open settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setActivePanel(activePanel === 'settings' ? 'editor' : 'settings');
        return;
      }

      // Cmd/Ctrl + H - toggle history
      if (isMod && e.key === 'h') {
        e.preventDefault();
        setActivePanel(activePanel === 'history' ? 'editor' : 'history');
        return;
      }

      // Cmd/Ctrl + K - toggle snippets
      if (isMod && e.key === 'k') {
        e.preventDefault();
        setActivePanel(activePanel === 'snippets' ? 'editor' : 'snippets');
        return;
      }

      // Cmd/Ctrl + Shift + A - quick actions
      if (isMod && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setActivePanel(activePanel === 'actions' ? 'editor' : 'actions');
        return;
      }

      // Cmd/Ctrl + N - clear editor
      if (isMod && e.key === 'n') {
        e.preventDefault();
        useEditorStore.getState().clearContent();
        return;
      }

      // Text transformations
      if (isMod && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'u':
            e.preventDefault();
            transformText('uppercase');
            break;
          case 'l':
            e.preventDefault();
            transformText('lowercase');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText]);
}
