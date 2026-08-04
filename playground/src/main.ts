import { createApp } from 'vue'
import App from './App.vue'
// Порядок обязателен: сброс идёт до утилит. В нём есть
// `[type='button'] { background-color: transparent }` — специфичность та же,
// что у класса, поэтому сброс после утилит забирал фон у каждой кнопки.
import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

import { createFintI18n } from '@feugene/fint-i18n/core'
import { createFintI18nPlugin } from '@feugene/fint-i18n/vue'
import { PersistencePlugin } from '@feugene/fint-i18n/plugins'

// Opt-in global type augmentation: makes `$t`, `$i18n` and `v-t` type-check in
// templates. Runtime registration is done by the plugin below; this import only
// adds the TypeScript declarations (no runtime cost).
import '@feugene/fint-i18n/vue/global-types'

// ---------------------------------------------------------------------------
// Вариант 1 (используется в playground): per-locale импорт.
// Бандлер уносит в сборку только перечисленные языки, остальные tree-shake'ятся.
// ---------------------------------------------------------------------------
import { en, es, ru } from './i18n/messages'

// ---------------------------------------------------------------------------
// Вариант 2: один "all"-пакет — массив всех локалей одного источника.
// Подходит для демо/e2e/инструментов, где размер бандла не важен.
// ---------------------------------------------------------------------------
// import allMessages from './i18n/messages/all'
// // allMessages: LocaleLoaderCollection[]  ([{ en: {...} }, { ru: {...} }])

// ---------------------------------------------------------------------------
// Вариант 3: несколько "all"-коллекций из разных пакетов (например, ядро
// приложения + плагины/фичи, каждый из которых публикует свой `<pkg>/i18n/all`).
//
// `createFintI18n({ loaders })` принимает `LocaleLoaderCollection | LocaleLoaderCollection[]`,
// поэтому достаточно объединить массивы spread'ом. Реестр локалей сам:
//   - сольёт коллекции в одну нормализованную мапу,
//   - объединит лоадеры одинаковых блоков одной и той же локали
//     (например, `common` из core + `common` из плагина), сохранив порядок.
// ---------------------------------------------------------------------------
// import coreMessages    from '@my-org/core/i18n/all'      // LocaleLoaderCollection[]
// import billingMessages from '@my-org/billing/i18n/all'   // LocaleLoaderCollection[]
// import appMessages     from './i18n/messages/all'        // LocaleLoaderCollection[]
//
// const loaders = [
//   ...coreMessages,
//   ...billingMessages,
//   ...appMessages,
// ]
//
// // Если какой-то пакет экспортирует одиночную коллекцию (LocaleLoaderCollection,
// // а не массив), её можно добавить как есть — без spread:
// //   const loaders = [...coreMessages, singlePackage, ...appMessages]

// Optional typed message schema: passing it to `createFintI18n<Schema>()` gives
// `t()` autocompletion and typo-checking for these literal keys, while still
// accepting arbitrary strings for dynamically built keys (lazy blocks, etc.).
type PlaygroundMessages = {
  common: {
    welcome: string
    changeLang: string
    currentLang: string
    blocks: string
    namePlaceholder: string
    escaped: string
  }
}

const i18n = createFintI18n<PlaygroundMessages>({
  locale: 'en',
  fallbackLocale: 'en',
  // Preload the fallback locale alongside each block so the fallback chain
  // (see the "Fallback locale" section) resolves even before a locale switch.
  preloadFallback: true,
  // Per-locale imports keep the bundle tree-shakable: only the languages
  // listed here end up in the production build.
  loaders: [en, ru, es],
  // Вариант 2:
  // loaders: allMessages,
  // Вариант 3:
  // loaders,
  plugins: [
    new PersistencePlugin({ key: 'fint-i18n-playground-locale' })
  ]
})

const app = createApp(App)
// Conventional Vue plugin form (wraps installI18n): registers provide/inject,
// the global `$t`/`$i18n` properties and the `v-t` directive.
app.use(createFintI18nPlugin(i18n))
app.mount('#app')
