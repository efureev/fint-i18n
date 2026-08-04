import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Обе витрины исключены: у них свой прогон (playground/vitest.config.ts).
      // Шаблон без `-ssr` не матчил бы `playground-ssr/`, и её тесты попадали бы
      // в пакетный прогон вторым экземпляром.
      '**/playground/**',
      '**/playground-ssr/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest}.config.*',
    ],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit-report.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html', 'json-summary'],
      reportsDirectory: 'coverage/package',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/**/*.spec.ts', 'src/index.ts'],
      // Пороги стоят чуть ниже фактического покрытия: они запрещают падение,
      // а не требуют роста. Поднимать вместе с реальным улучшением.
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 78,
        lines: 86,
      },
    },
  },
})
