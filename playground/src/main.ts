import { createApp } from 'vue'
import App from './App.vue'
import 'virtual:uno.css'
import '@unocss/reset/tailwind.css'

import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { PersistencePlugin } from '@feugene/fint-i18n/plugins'

// ---------------------------------------------------------------------------
// Вариант 1 (используется в playground): per-locale импорт.
// Бандлер уносит в сборку только перечисленные языки, остальные tree-shake'ятся.
// ---------------------------------------------------------------------------
import { en, ru } from './i18n/messages'

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

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  // Per-locale imports keep the bundle tree-shakable: only the languages
  // listed here end up in the production build.
  loaders: [en, ru],
  // Вариант 2:
  // loaders: allMessages,
  // Вариант 3:
  // loaders,
  plugins: [
    new PersistencePlugin({ key: 'fint-i18n-playground-locale' })
  ]
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
