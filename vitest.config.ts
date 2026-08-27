import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const { version } = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
)

export default defineConfig({
  plugins: [vue()],
  // Тот же токен, что в сборке: без него `createDevtools()` в тестах отдавал бы
  // версию `unknown`, и контракт моста был бы непроверяемым.
  define: {
    __FINT_I18N_VERSION__: JSON.stringify(version),
  },
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
    // Скрипты из `scripts/` — обычные Node-модули с shebang'ом (они же `bin`).
    // Vite дописывает свой импорт перед первой строкой и ломается о `#!`, а
    // трансформировать их незачем: они и запускаются голым Node.
    server: {
      deps: {
        external: [/scripts\/.*\.mjs$/],
      },
    },
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
      //
      // Спрос идёт послойно, и это не украшение. Глобальный порог считается по
      // всем файлам сразу, включая попавшие под глобы, поэтому одно общее число
      // на пакет означало бы среднее по рантайму и отладочной обвязке: просадка
      // в ядре пряталась бы за массой devtools, а с ядра спрашивать столько же,
      // сколько с панели, незачем — в прод она не попадает ни байтом
      // (`yarn check:devtools`). Общее число оставлено полом, гарантию несут
      // строки ниже.
      thresholds: {
        statements: 95,
        branches: 89,
        functions: 95,
        lines: 97,
        'src/core/**': { statements: 99, branches: 96, functions: 97, lines: 99 },
        'src/vue/**': { statements: 98, branches: 96, functions: 100, lines: 98 },
        'src/plugins/**': { statements: 100, branches: 98, functions: 100, lines: 100 },
        'src/vite/**': { statements: 97, branches: 92, functions: 100, lines: 98 },
        'src/devtools/**': { statements: 90, branches: 79, functions: 92, lines: 93 },
      },
    },
  },
})
