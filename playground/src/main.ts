import { createApp } from 'vue'
import App from './App.vue'
import 'virtual:uno.css'
import '@unocss/reset/tailwind.css'

import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { PersistencePlugin } from '@feugene/fint-i18n/plugins'
import { en, ru } from './i18n/messages'
// import loaders from "./i18n/messages/all";

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  // Per-locale imports keep the bundle tree-shakable: only the languages
  // listed here end up in the production build.
  loaders: [en, ru],
  // loaders,
  plugins: [
    new PersistencePlugin({ key: 'fint-i18n-playground-locale' })
  ]
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
