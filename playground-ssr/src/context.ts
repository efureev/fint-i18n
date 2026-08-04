import type { InjectionKey } from 'vue'
import type { LoaderStats } from './i18n'

/**
 * Всё, что витрине нужно знать о том, как её отрисовали. Живёт отдельно от
 * снимка i18n: тот описывает только сообщения и блоки.
 *
 * Здесь лежит лишь то, что известно **до** рендера, — иначе сервер и клиент
 * отрисовали бы разное. Размер снимка и его состав становятся известны уже
 * после рендера, поэтому панель читает их из `window.__STATE__` в `onMounted`.
 */
export interface AppContext {
  /** Счётчик вызовов лоадеров текущего инстанса. */
  stats: LoaderStats
  /** Вызовы, случившиеся на сервере. */
  serverCalls: string[]
  /** Была ли применена гидрация (выключается через `?hydrate=0`). */
  hydrated: boolean
  /** Момент рендера, зафиксированный сервером. */
  renderedAt: string
}

export const APP_CONTEXT: InjectionKey<AppContext> = Symbol('fint-i18n-ssr-playground')
