import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react()],

  // Tauri expects a fixed port, fail if port is occupied
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Exclude Rust build artifacts from HMR
      ignored: ['**/src-tauri/**'],
    },
  },

  // Produce separate source maps for debugging
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS and Linux
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    // Don't minify for debug builds
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },

  // Environment variables
  envPrefix: ['VITE_', 'TAURI_ENV_'],

  // Clear screen setting
  clearScreen: false,
});
