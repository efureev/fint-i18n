import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

/**
 * Конфиг обеих витрин: статической (`playground/`) и SSR (`playground-ssr/`).
 * Отдельный прогон для второй завёл бы третий гейт в CI ради тех же проверок.
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@feugene/fint-i18n/core': fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
      // Более специфичный алиас — до менее специфичного.
      '@feugene/fint-i18n/vue/global-types': fileURLToPath(new URL('../src/vue/global-types.ts', import.meta.url)),
      '@feugene/fint-i18n/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
      '@feugene/fint-i18n/plugins': fileURLToPath(new URL('../src/plugins/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['playground/src/**/*.{test,spec}.{ts,tsx}', 'playground-ssr/src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '../coverage/playground',
      include: ['playground/src/**/*.vue', 'playground/src/**/*.ts', 'playground-ssr/src/**/*.vue', 'playground-ssr/src/**/*.ts'],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/*.spec.ts'],
    },
  },
})
