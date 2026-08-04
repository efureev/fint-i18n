import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Витрина работает с **исходниками** пакета через алиасы, а не со сборкой —
 * как и основной playground. Пересобирать библиотеку перед проверкой не нужно.
 */
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  plugins: [vue()],
  resolve: {
    alias: {
      '@feugene/fint-i18n/core': fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
      // Более специфичный алиас — до менее специфичного, иначе префикс `/vue`
      // проглотил бы `/vue/global-types`.
      '@feugene/fint-i18n/vue/global-types': fileURLToPath(new URL('../src/vue/global-types.ts', import.meta.url)),
      '@feugene/fint-i18n/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
      '@feugene/fint-i18n/plugins': fileURLToPath(new URL('../src/plugins/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 3100,
  },
})
