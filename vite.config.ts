import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from 'rollup-plugin-visualizer'

const isAnalyze = process.env.ANALYZE === 'true'

export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/playground/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**', '**/{karma,rollup,webpack,vite,vitest}.config.*'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit-report.xml' // Файл будет создан в корне проекта
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html', 'json-summary'],
      reportsDirectory: 'coverage/package',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/index.ts'],
    },
  },
  plugins: [
    vue(),
    ...(isAnalyze
      ? [
        visualizer({
          emitFile: true,
          filename: 'analysis/stats.html',
          title: '@feugene/fint-i18n bundle report',
          template: 'treemap',
          gzipSize: true,
          brotliSize: true,
          projectRoot: fileURLToPath(new URL('./', import.meta.url)),
        }) as PluginOption,
        visualizer({
          emitFile: true,
          filename: 'analysis/stats.json',
          template: 'raw-data',
          projectRoot: fileURLToPath(new URL('./', import.meta.url)),
        }) as PluginOption,
        visualizer({
          emitFile: true,
          filename: 'analysis/stats.md',
          title: '@feugene/fint-i18n bundle report',
          template: 'markdown',
          gzipSize: true,
          brotliSize: true,
          projectRoot: fileURLToPath(new URL('./', import.meta.url)),
        }) as PluginOption,
      ]
      : []),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@feugene/fint-i18n/core': fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
      '@feugene/fint-i18n/vue': fileURLToPath(new URL('./src/vue/index.ts', import.meta.url)),
      '@feugene/fint-i18n/plugins': fileURLToPath(new URL('./src/plugins/index.ts', import.meta.url)),
      '@feugene/fint-i18n': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
    },
  },
  build: {
    target: 'esnext',
    minify: 'oxc',
    lib: {
      entry: {
        index: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
        core: fileURLToPath(new URL('./src/core/index.ts', import.meta.url)),
        vue: fileURLToPath(new URL('./src/vue/index.ts', import.meta.url)),
        plugins: fileURLToPath(new URL('./src/plugins/index.ts', import.meta.url)),
      },
      formats: ['es'],
    },
    rolldownOptions: {
      external: [
        'vue',
      ],
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
      },
    },
  },
})
