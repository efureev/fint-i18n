import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { getSSRState } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import App from './App.vue'
import { APP_CONTEXT } from './context'
import type { AppContext } from './context'
import { createI18n, isLocale } from './i18n'
import type { PlaygroundLocale } from './i18n'

export interface RenderResult {
  html: string
  /** Готовая к вставке в разметку строка: `<` уже экранирован. */
  payload: string
  locale: PlaygroundLocale
  hydrate: boolean
}

/**
 * Экранирование `<` обязательно: перевод, содержащий `</script>`, иначе закрыл
 * бы тег и уронил страницу. Библиотека отдаёт объект — ответственность за
 * безопасную сериализацию лежит на приложении.
 */
function serialize(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

export async function render(url: string): Promise<RenderResult> {
  const query = new URL(url, 'http://localhost').searchParams
  const requested = query.get('locale')
  const locale: PlaygroundLocale = isLocale(requested) ? requested : 'en'
  // `?hydrate=0` оставляет снимок неприменённым — так видно разницу.
  const hydrate = query.get('hydrate') !== '0'

  // Инстанс на запрос. Разделяемый между запросами хранил бы чужие блоки и
  // чужую локаль.
  const { i18n, stats } = createI18n(locale)

  const renderedAt = new Date().toISOString()
  const context: AppContext = {
    stats,
    serverCalls: stats.calls,
    hydrated: hydrate,
    renderedAt,
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
    app: { renderedAt, hydrated: hydrate, serverCalls: [...stats.calls] },
  })

  // Per-request инстанс отпускается: словари, кэши и подписки освобождаются.
  // Снимок снят раньше и на инстанс уже не смотрит.
  i18n.dispose()

  return { html, payload, locale, hydrate }
}
