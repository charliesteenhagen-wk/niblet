import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { useSettings } from '../hooks/useSettings';
import { useEditorStore } from '../stores/editorStore';
import type { ThemeType } from '../types';

interface UpdateInfo {
  current_version: string;
  latest_version: string;
  has_update: boolean;
  release_url: string;
  release_notes: string | null;
  download_url: string | null;
}

const THEMES: { value: ThemeType; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'high-contrast', label: 'High Contrast' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
  { value: 'solarized-light', label: 'Solarized Light' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'nord', label: 'Nord' },
];

export function SettingsPanel() {
  const { settings, handleUpdate, handleReset } = useSettings();
  const { setActivePanel } = useEditorStore();
  const [hotkeyInput, setHotkeyInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');

  // Get app version on mount
  useEffect(() => {
    invoke<string>('get_app_version').then(setAppVersion).catch(console.error);
  }, []);

  const checkForUpdates = async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      const info = await invoke<UpdateInfo>('check_for_app_updates');
      setUpdateInfo(info);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const openDownloadUrl = async () => {
    const url = updateInfo?.download_url || updateInfo?.release_url;
    if (url) {
      await open(url);
    }
  };

  useEffect(() => {
    if (settings) {
      setHotkeyInput(settings.hotkey);
    }
  }, [settings]);

  // Record hotkey when user presses keys
  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];

      // Modifiers (use Command for macOS, Control for others)
      if (e.metaKey) parts.push('Command');
      if (e.ctrlKey) parts.push('Control');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      // Main key (exclude modifier-only presses)
      const key = e.key;
      if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
        // Convert key to proper format
        let keyName = key.toUpperCase();
        if (key === ' ') keyName = 'Space';
        else if (key.length === 1) keyName = key.toUpperCase();
        parts.push(keyName);

        // Only set if we have at least one modifier + a key
        if (parts.length >= 2) {
          const hotkey = parts.join('+');
          setHotkeyInput(hotkey);
          setIsRecording(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  if (!settings) return <div className="p-4">Loading...</div>;

  const saveHotkey = () => {
    if (hotkeyInput && hotkeyInput !== settings.hotkey) {
      handleUpdate({ hotkey: hotkeyInput });
    }
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={() => setActivePanel('editor')}
          className="btn"
          aria-label="Close settings"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-6">
          {/* Hotkey Configuration */}
          <div>
            <label className="block text-sm font-medium mb-2">Global Hotkey</label>
            <p className="text-xs text-[var(--editor-muted)] mb-3">
              Press this keyboard shortcut anywhere to summon Niblet
            </p>

            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={isRecording ? 'Press keys...' : hotkeyInput}
                  readOnly
                  className={`input w-full ${isRecording ? 'ring-2 ring-[var(--editor-accent)]' : ''}`}
                  placeholder="Command+Shift+Space"
                />
              </div>
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={`btn px-3 ${isRecording ? 'bg-[var(--editor-accent)] text-white' : ''}`}
              >
                {isRecording ? 'Cancel' : 'Record'}
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={saveHotkey}
                disabled={hotkeyInput === settings.hotkey}
                className="btn bg-[var(--editor-accent)] text-white disabled:opacity-50"
              >
                Save Hotkey
              </button>
              <button
                onClick={() => setHotkeyInput(settings.hotkey)}
                disabled={hotkeyInput === settings.hotkey}
                className="btn disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Hotkey Examples */}
          <div className="text-xs text-[var(--editor-muted)] space-y-1">
            <p className="font-medium text-[var(--editor-text)]">Example hotkeys:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Command+Shift+Space (macOS)</li>
              <li>Control+Shift+Space (Windows/Linux)</li>
              <li>Command+Shift+N</li>
              <li>Control+Alt+Q</li>
            </ul>
          </div>

          {/* Theme Selection */}
          <div className="mt-6 pt-6 border-t border-[var(--editor-border)]">
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-2">
              {THEMES.map((theme) => {
                const isSelected = settings?.theme === theme.value;
                return (
                  <button
                    key={theme.value}
                    onClick={() => handleUpdate({ theme: theme.value })}
                    className={`px-3 py-2 text-sm rounded-md border transition-all ${
                      isSelected
                        ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                        : 'border-[var(--editor-border)] hover:border-[var(--editor-muted)]'
                    }`}
                  >
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div className="mt-6">
            <p className="text-sm font-medium mb-3">Keyboard Shortcuts</p>

            {/* Editor shortcuts */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Editor</p>
              <div className="space-y-1.5">
                <ShortcutRow keys="Cmd/Ctrl + Enter" description="Copy to clipboard & close" />
                <ShortcutRow keys="Escape" description="Close panel or window (keeps text)" />
                <ShortcutRow keys="Cmd/Ctrl + N" description="Clear editor" />
              </div>
            </div>

            {/* Navigation shortcuts */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Navigation</p>
              <div className="space-y-1.5">
                <ShortcutRow keys="Cmd/Ctrl + ," description="Open settings" />
                <ShortcutRow keys="Cmd/Ctrl + H" description="Toggle history panel" />
                <ShortcutRow keys="Cmd/Ctrl + K" description="Toggle snippets panel" />
                <ShortcutRow keys="Cmd/Ctrl + Shift + A" description="Quick actions menu" />
              </div>
            </div>

            {/* Text transform shortcuts */}
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Text Transforms</p>
              <div className="space-y-1.5">
                <ShortcutRow keys="Cmd/Ctrl + Shift + U" description="Transform to UPPERCASE" />
                <ShortcutRow keys="Cmd/Ctrl + Shift + L" description="Transform to lowercase" />
              </div>
            </div>

            {/* List navigation */}
            <div>
              <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">History & Snippets Panels</p>
              <div className="space-y-1.5">
                <ShortcutRow keys="↑ / ↓" description="Navigate through items" />
                <ShortcutRow keys="Enter" description="Select item" />
                <ShortcutRow keys="Type" description="Focus search and filter" />
              </div>
            </div>
          </div>

          {/* Updates Section */}
          <div className="mt-6 pt-6 border-t border-[var(--editor-border)]">
            <p className="text-sm font-medium mb-2">Updates</p>
            <p className="text-xs text-[var(--editor-muted)] mb-3">
              Current version: {appVersion || 'Loading...'}
            </p>

            <button
              onClick={checkForUpdates}
              disabled={isCheckingUpdate}
              className="btn bg-[var(--editor-surface)] hover:bg-[var(--editor-border)] disabled:opacity-50"
            >
              {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
            </button>

            {updateError && (
              <p className="text-xs text-red-400 mt-2">{updateError}</p>
            )}

            {updateInfo && !updateError && (
              <div className="mt-3 p-3 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)]">
                {updateInfo.has_update ? (
                  <>
                    <p className="text-sm text-green-400 mb-2">
                      Update available: {updateInfo.latest_version}
                    </p>
                    <button
                      onClick={openDownloadUrl}
                      className="btn bg-[var(--editor-accent)] text-white text-sm"
                    >
                      Download Update
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-[var(--editor-muted)]">
                    You're running the latest version
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-[var(--editor-border)] rounded-b-xl">
        <button onClick={handleReset} className="btn text-red-400 hover:text-red-300 text-sm">
          Reset All Settings
        </button>
      </div>
    </div>
  );
}

function ShortcutRow({ keys, description }: { keys: string; description: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--editor-muted)]">{description}</span>
      <kbd className="px-1.5 py-0.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded text-[var(--editor-text)] font-mono">
        {keys}
      </kbd>
    </div>
  );
}
