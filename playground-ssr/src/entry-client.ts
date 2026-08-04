import { createSSRApp } from 'vue'
import { hydrate } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import App from './App.vue'
import { APP_CONTEXT } from './context'
import { createI18n, isLocale } from './i18n'

const state = (window as any).__STATE__ as {
  i18n: Parameters<typeof hydrate>[1]
  app: { renderedAt: string, hydrated: boolean, serverCalls: string[] }
}

// Локаль берётся из того же источника, что и на сервере: в снимке её нет
// намеренно, иначе об одном факте было бы два источника правды.
const requested = new URL(window.location.href).searchParams.get('locale')
const locale = isLocale(requested) ? requested : 'en'

const { i18n, stats } = createI18n(locale)

// Гидрация обязана произойти ДО монтирования: она помечает блоки загруженными,
// и `useI18nScope` в компонентах разрешается мгновенно, без похода в сеть.
if (state.app.hydrated) {
  hydrate(i18n, state.i18n)
}

const app = createSSRApp(App)
installI18n(app, i18n)
app.provide(APP_CONTEXT, {
  stats,
  serverCalls: state.app.serverCalls,
  hydrated: state.app.hydrated,
  renderedAt: state.app.renderedAt,
})
app.mount('#app')
