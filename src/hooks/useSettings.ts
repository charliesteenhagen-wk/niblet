import { useEffect, useCallback } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AppSettings } from '../types';

export function useSettings() {
  const { settings, loading, error, loadSettings, updateSettings, resetToDefaults } =
    useSettingsStore();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleUpdate = useCallback(
    async (newSettings: Partial<AppSettings>) => {
      await updateSettings(newSettings);
    },
    [updateSettings]
  );

  const handleReset = useCallback(async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      await resetToDefaults();
    }
  }, [resetToDefaults]);

  return {
    settings,
    loading,
    error,
    handleUpdate,
    handleReset,
  };
}
