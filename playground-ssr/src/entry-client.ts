import { createSSRApp } from 'vue'
import { hydrate } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import App from './App.vue'
import { APP_CONTEXT } from './context'
import type { LocaleSource } from './context'
import { createI18n, isLocale } from './i18n'

const state = (window as any).__STATE__ as {
  i18n: Parameters<typeof hydrate>[1]
  app: {
    renderedAt: string
    hydrated: boolean
    serverCalls: string[]
    locale: string
    localeSource: LocaleSource
    acceptLanguage: string
  }
}

// Локаль берётся из снимка, а не выводится заново: сервер мог выбрать её из
// `Accept-Language`, а этот заголовок браузерному JS недоступен. Вывод «своей»
// локали здесь разошёлся бы с отрисованной разметкой.
const locale = isLocale(state.app.locale) ? state.app.locale : 'en'

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
  localeSource: state.app.localeSource,
  acceptLanguage: state.app.acceptLanguage,
})
app.mount('#app')

// Панель отладки — только на клиенте и только после гидрации: на сервере
// `document` нет, а до гидрации снимок показал бы состояние, которого у
// приложения ещё нет. Это же и есть проверка того, что оверлей переживает SSR.
void import('@feugene/fint-i18n/devtools').then(({ createDevtools, mountDevtoolsOverlay }) => {
  return mountDevtoolsOverlay(createDevtools(i18n), { position: 'bottom-left' })
})
