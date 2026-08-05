import { reactive } from 'vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import type { FintI18n, LocaleLoaderCollection } from '@feugene/fint-i18n/core'

export const LOCALES = ['en', 'ru'] as const
export type PlaygroundLocale = (typeof LOCALES)[number]

export function isLocale(value: unknown): value is PlaygroundLocale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

/** Счётчик вызовов лоадеров — им и доказывается, что гидрация сработала. */
export interface LoaderStats {
  calls: string[]
}

/**
 * Лоадеры создаются на каждый инстанс, а не на модуль: счётчик должен быть
 * привязан к запросу, иначе на сервере он копился бы между запросами.
 */
function buildLoaders(stats: LoaderStats): LocaleLoaderCollection[] {
  const track = <T>(locale: string, block: string, load: () => Promise<T>) => async () => {
    stats.calls.push(`${locale}:${block}`)
    return load()
  }

  return [
    {
      en: {
        common: track('en', 'common', () => import('./locales/en/common.json')),
        cart: track('en', 'cart', () => import('./locales/en/cart.json')),
        stats: track('en', 'stats', () => import('./locales/en/stats.json')),
        // Блок отложенной секции: страница его не рисует, поэтому лоадер зовёт
        // только компонент, приезжающий по клику.
        promo: track('en', 'promo', () => import('./locales/en/promo.json')),
      },
    },
    {
      ru: {
        common: track('ru', 'common', () => import('./locales/ru/common.json')),
        cart: track('ru', 'cart', () => import('./locales/ru/cart.json')),
        stats: track('ru', 'stats', () => import('./locales/ru/stats.json')),
        promo: track('ru', 'promo', () => import('./locales/ru/promo.json')),
      },
    },
  ]
}

export interface CreatedI18n {
  i18n: FintI18n
  stats: LoaderStats
}

/**
 * Свежий инстанс на каждый запрос. Разделять один между запросами нельзя:
 * состояние блоков и текущая локаль у них разные.
 */
export function createI18n(locale: PlaygroundLocale): CreatedI18n {
  // Массив реактивен: блок может догрузиться и после гидрации (отложенная
  // секция), и панель обязана показать это, а не снимок на момент монтирования.
  const stats: LoaderStats = { calls: reactive<string[]>([]) }

  return {
    i18n: createFintI18n({ locale, loaders: buildLoaders(stats) }),
    stats,
  }
}
