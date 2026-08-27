import type { FintI18n, Locale, LocaleLoaderCollection, MessageSchema } from '../core'
import { readLoaderMap } from './internals'

export interface SimulationOptions {
  /** Задержка перед ответом лоадера, мс. */
  delay?: number
  /** Доля отказов, 0..1. Считается на каждый вызов лоадера. */
  failureRate?: number
  /**
   * Отказывать первые K попыток загрузки блока, потом пропускать. Имеет смысл
   * только у инстанса с включённой опцией `retry` — без неё первый отказ
   * окончателен, и повторов, которые можно было бы увидеть, просто нет.
   */
  failAttempts?: number
  /** Ограничить конкретными блоками. По умолчанию — все зарегистрированные. */
  blocks?: string[]
}

export interface DevtoolsSimulator {
  readonly active: boolean
  readonly options: SimulationOptions | null
  start: (options?: SimulationOptions) => void
  stop: () => void
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * Пути отказа — `ready`/`error` у `useI18nScopeSync`, повторы, поведение
 * `preloadFallback` — иначе проверяются только юнит-тестами: в живом приложении
 * лоадер не заставить упасть.
 *
 * Симулятор ничего не подменяет. Он регистрирует через публичный `addLoaders()`
 * **дополнительный** лоадер каждому блоку: пустой объект домерживается вникуда,
 * зато отказ и задержка проходят настоящим путём — через `runLoader`, повторы и
 * `onError`. Пока симуляция выключена, лоадер возвращает пустой объект сразу.
 */
export function createSimulator(instance: FintI18n): DevtoolsSimulator {
  const attempts = new Map<string, number>()
  const registered = new Set<string>()
  let options: SimulationOptions | null = null

  const applies = (block: string): boolean => {
    if (!options) return false

    return !options.blocks || options.blocks.includes(block)
  }

  const shouldFail = (block: string, locale: Locale): boolean => {
    if (!options) return false

    const key = `${locale}:${block}`
    const seen = (attempts.get(key) ?? 0) + 1
    attempts.set(key, seen)

    if (options.failAttempts && seen <= options.failAttempts) return true

    return Boolean(options.failureRate) && Math.random() < options.failureRate!
  }

  const hook = (block: string, locale: Locale) => async (): Promise<MessageSchema> => {
    if (!applies(block)) return {}

    if (options?.delay) await wait(options.delay)

    if (shouldFail(block, locale)) {
      throw new Error(`[fint-i18n] simulated failure of block "${block}" in locale "${locale}"`)
    }

    return {}
  }

  return {
    get active() {
      return options !== null
    },

    get options() {
      return options
    },

    start(next = {}) {
      options = next
      attempts.clear()

      const map = readLoaderMap(instance)
      if (!map) {
        console.warn('[fint-i18n] devtools cannot read the loader registry; simulation is limited to blocks loaded later')
        return
      }

      // Регистрация одноразовая: снять лоадер публичным API нельзя, поэтому
      // выключённая симуляция делает его пустышкой, а не удаляет.
      const additions: LocaleLoaderCollection = {}

      for (const locale in map) {
        for (const block of map[locale]) {
          const key = `${locale}:${block}`
          if (registered.has(key)) continue

          registered.add(key)
          ;(additions[locale] ??= {})[block] = hook(block, locale)
        }
      }

      if (Object.keys(additions).length > 0) instance.addLoaders(additions)
    },

    stop() {
      options = null
      attempts.clear()
    },
  }
}
