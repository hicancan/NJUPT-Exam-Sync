import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    'import.meta.env.VITE_NJUPT_SEARCH_ARTIFACT_URL': JSON.stringify('/generated/search'),
    'import.meta.env.VITE_NJUPT_EXAM_ARTIFACT_URL': JSON.stringify('/generated/exam'),
    'import.meta.env.VITE_NJUPT_EXAM_HISTORY_ARTIFACT_URL': JSON.stringify('/generated/exam/history'),
    'import.meta.env.VITE_NJUPT_ROOM_ARTIFACT_URL': JSON.stringify('/generated/rooms'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
      '@njupt-search/academics-exam': path.resolve(__dirname, './academics/exam'),
      '@njupt-search/academics-exam/calendar': path.resolve(__dirname, './academics/exam/calendar.ts'),
      '@njupt-search/academics-exam/history': path.resolve(__dirname, './academics/exam/history/index.ts'),
      '@njupt-search/academics-room': path.resolve(__dirname, './academics/room/index.ts'),
      '@njupt-search/search-browser': path.resolve(__dirname, './search/browser/src/index.ts'),
    },
  },
  test: {
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'academics/**/*.test.{ts,tsx}',
      'search/browser/src/**/*.test.{ts,tsx}',
    ],
  },
});
