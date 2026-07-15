import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base: '/fint-i18n/',
  plugins: [
    vue(),
    UnoCSS({
      configFile: fileURLToPath(new URL('./uno.config.ts', import.meta.url)),
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@feugene/fint-i18n/core': fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
      // Keep the more specific `/vue/global-types` alias before `/vue`,
      // otherwise the `/vue` prefix would swallow it.
      '@feugene/fint-i18n/vue/global-types': fileURLToPath(new URL('../src/vue/global-types.ts', import.meta.url)),
      '@feugene/fint-i18n/vue': fileURLToPath(new URL('../src/vue/index.ts', import.meta.url)),
      '@feugene/fint-i18n/plugins': fileURLToPath(new URL('../src/plugins/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
})
