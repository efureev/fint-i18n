import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { getSSRState, negotiateLocale, parseAcceptLanguage } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import App from './App.vue'
import { APP_CONTEXT } from './context'
import type { AppContext, LocaleSource } from './context'
import { createI18n, isLocale, LOCALES } from './i18n'
import type { PlaygroundLocale } from './i18n'

export interface RenderResult {
  html: string
  /** Готовая к вставке в разметку строка: `<` уже экранирован. */
  payload: string
  locale: PlaygroundLocale
  hydrate: boolean
  localeSource: LocaleSource
}

/**
 * Экранирование `<` обязательно: перевод, содержащий `</script>`, иначе закрыл
 * бы тег и уронил страницу. Библиотека отдаёт объект — ответственность за
 * безопасную сериализацию лежит на приложении.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export async function render(url: string, acceptLanguage = ''): Promise<RenderResult> {
  const query = new URL(url, 'http://localhost').searchParams
  const requested = query.get('locale')
  // `?hydrate=0` оставляет снимок неприменённым — так видно разницу.
  const hydrate = query.get('hydrate') !== '0'

  // `?locale=` — ручное переключение, оно выигрывает всегда. Без него локаль
  // выбирается из `Accept-Language`: на сервере это единственный источник
  // языковых предпочтений, `navigator.languages` здесь нет.
  let locale: PlaygroundLocale = 'en'
  let localeSource: LocaleSource = 'default'

  if (isLocale(requested)) {
    locale = requested
    localeSource = 'query'
  }
  else {
    const negotiated = negotiateLocale(parseAcceptLanguage(acceptLanguage), LOCALES)
    if (isLocale(negotiated)) {
      locale = negotiated
      localeSource = 'header'
    }
  }

  // Инстанс на запрос. Разделяемый между запросами хранил бы чужие блоки и
  // чужую локаль.
  const { i18n, stats } = createI18n(locale)

  const renderedAt = new Date().toISOString()
  const context: AppContext = {
    stats,
    serverCalls: stats.calls,
    hydrated: hydrate,
    renderedAt,
    localeSource,
    acceptLanguage,
  }

  const app = createSSRApp(App)
  installI18n(app, i18n)
  app.provide(APP_CONTEXT, context)

  // `renderToString` дожидается `useI18nScope`, поэтому к моменту снятия
  // снимка загружено всё, что отрисовала страница.
  const html = await renderToString(app)

  const state = getSSRState(i18n, { locales: [locale] })
  const payload = serialize({
    i18n: state,
    // Локаль едет в снимке: вывести её на клиенте больше неоткуда — при выборе
    // из `Accept-Language` заголовок браузерному JS недоступен, а
    // `navigator.languages` заголовку не тождествен. Разойдись они — получили
    // бы расхождение гидрации.
    app: { renderedAt, hydrated: hydrate, serverCalls: [...stats.calls], locale, localeSource, acceptLanguage },
  })

  // Per-request инстанс отпускается: словари, кэши и подписки освобождаются.
  // Снимок снят раньше и на инстанс уже не смотрит.
  i18n.dispose()

  return { html, payload, locale, hydrate, localeSource }
}
