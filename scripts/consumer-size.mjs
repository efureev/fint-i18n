import { gzipSync } from 'node:zlib'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { build } from 'vite'

/**
 * Сколько байт добавит пакет потребителю.
 *
 * `check-size.mjs` меряет другое — размер отгружаемых чанков `dist`. Чанк не
 * равен цене: часть его тришейкается у того, кто половину API не импортирует.
 * Здесь каждый сценарий собирается отдельным бандлом с `vue` наружу, ровно как
 * это сделает сборщик приложения.
 *
 *   yarn build && node scripts/consumer-size.mjs
 */

const root = fileURLToPath(new URL('..', import.meta.url))

/**
 * Каждый сценарий **пользуется** импортированным и складывает результат в
 * `globalThis`. Реэкспорт (`export * from`) здесь не годится: он удерживает
 * всю поверхность модуля и намерил бы размер чанка — то, что уже меряет
 * `check-size.mjs`.
 */
const SCENARIOS = [
  ['core-only', 'createFintI18n + t()', `
    import { createFintI18n } from '${root}dist/core.js'
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: () => Promise.resolve({ b: 'Hi, {name}' }) } } })
    i18n.mergeMessages('en', 'a', { b: 'Hello, {name}' })
    await i18n.loadBlock('a')
    globalThis.out = [i18n.t('a.b', { name: 'x' }), i18n.setLocale, i18n.locale]
  `],
  ['vue-app', '+ Vue layer: plugin, useI18nScope, v-t', `
    import { createFintI18n } from '${root}dist/core.js'
    import { createFintI18nPlugin, useFintI18n, useI18nScope } from '${root}dist/vue.js'
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: () => Promise.resolve({ b: 'Hi, {name}' }) } } })
    globalThis.out = [createFintI18nPlugin(i18n), useFintI18n, useI18nScope, i18n.t('a.b')]
  `],
  ['vue-format', '+ n() / d() formatting', `
    import { createFintI18n } from '${root}dist/core.js'
    import { createFintI18nPlugin, useFintI18n, useI18nFormat, useI18nScope } from '${root}dist/vue.js'
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: () => Promise.resolve({ b: 'Hi, {name}' }) } } })
    globalThis.out = [createFintI18nPlugin(i18n), useFintI18n, useI18nScope, useI18nFormat, i18n.t('a.b')]
  `],
  ['everything', '+ SSR snapshot and PersistencePlugin', `
    import { createFintI18n, getSSRState, hydrate } from '${root}dist/core.js'
    import { createFintI18nPlugin, useFintI18n, useI18nFormat, useI18nScope } from '${root}dist/vue.js'
    import { PersistencePlugin } from '${root}dist/plugins.js'
    const i18n = createFintI18n({ locale: 'en', plugins: [new PersistencePlugin()], loaders: { en: { a: () => Promise.resolve({ b: 'Hi, {name}' }) } } })
    globalThis.out = [createFintI18nPlugin(i18n), useFintI18n, useI18nScope, useI18nFormat, getSSRState, hydrate, i18n.t('a.b')]
  `],
]

const workdir = mkdtempSync(join(tmpdir(), 'fint-consumer-'))
const results = []

try {
  for (const [name, label, source] of SCENARIOS) {
    const entry = join(workdir, `${name}.js`)
    const outDir = join(workdir, 'out', name)
    writeFileSync(entry, source)

    await build({
      configFile: false,
      logLevel: 'error',
      build: {
        outDir,
        emptyOutDir: true,
        // Те же настройки, что в vite.config.ts, иначе числа несравнимы
        // ни между собой, ни с бюджетом размера.
        target: 'esnext',
        minify: 'oxc',
        lib: { entry, formats: ['es'], fileName: 'bundle' },
        rollupOptions: { external: ['vue'] },
      },
    })

    const bytes = readdirSync(outDir)
      .filter(file => file.endsWith('.js') || file.endsWith('.mjs'))
      .reduce((sum, file) => sum + gzipSync(readFileSync(join(outDir, file)), { level: 9 }).length, 0)

    results.push({ label, bytes })
  }
}
finally {
  rmSync(workdir, { recursive: true, force: true })
}

console.log('Consumer cost (gzip -9, `vue` external)\n')
for (const { label, bytes } of results) {
  console.log(`  ${`${(bytes / 1024).toFixed(1)} KB`.padStart(8)}  ${label}`)
}

if (results.length !== SCENARIOS.length) process.exit(1)
