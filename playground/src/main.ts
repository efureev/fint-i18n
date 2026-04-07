import { createApp } from 'vue'
import App from './App.vue'
import 'virtual:uno.css'
import '@unocss/reset/tailwind.css'

import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import { PersistencePlugin } from '@feugene/fint-i18n/plugins'
import { loaders } from './i18n/messages'

const i18n = createFintI18n({
  locale: 'en',
  fallbackLocale: 'en',
  loaders,
  plugins: [
    new PersistencePlugin({ key: 'fint-i18n-playground-locale' })
  ]
})

const app = createApp(App)
installI18n(app, i18n)
app.mount('#app')
