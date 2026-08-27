import { toRaw } from 'vue'
import type { FintI18n, Locale, MessageSchema } from '../core'
import { readCompiledCounts } from './internals'
import type { BlockState } from './types'

const TOP_KEYS = 20
const DEFAULT_SAMPLING = 1

export interface MetricsOptions {
  /**
   * Считать каждый N-й вызов. По умолчанию 1 — считаются все.
   * Больше единицы разменивает точность на стоимость подписки.
   */
  sampling?: number
}

export interface MetricsSnapshot {
  enabled: boolean
  sampling: number
  /** Сколько вызовов реально сосчитано. */
  counted: number
  /** Оценка общего числа вызовов: `counted × sampling`. */
  calls: number
  distinctKeys: number
  /** Топ ключей; `calls` — та же оценка, а не точное число. */
  topKeys: { key: string, calls: number }[]
  /** Загрузки блоков по убыванию длительности. */
  slowestBlocks: { block: string, locale: Locale, duration: number }[]
  /**
   * Объём словарей в символах JSON — оценка, а не байты: для латиницы это
   * почти одно и то же, для кириллицы вдвое меньше правды.
   */
  dictionaryChars: Record<Locale, number>
  /** Скомпилировано ключей, по локалям. `null`, если кэш недоступен. */
  compiled: Record<Locale, number> | null
}

export interface DevtoolsMetrics {
  readonly enabled: boolean
  /** Включает подписку на `onTranslate` — единственный хук на каждом переводе. */
  enable: (options?: MetricsOptions) => void
  disable: () => void
  reset: () => void
  snapshot: () => MetricsSnapshot
}

/**
 * Сбор включается вручную и только на время: `onTranslate` — единственный хук,
 * который эмитится на каждый перевод, и подписка на него стоит около 17 % к
 * вызову `t()`. Панель говорит об этой цене вслух, пока вкладка открыта.
 */
export function createMetrics(
  instance: FintI18n,
  blocks: () => readonly BlockState[],
): DevtoolsMetrics {
  const counts = new Map<string, number>()
  let sampling = DEFAULT_SAMPLING
  let counted = 0
  let seen = 0
  let off: (() => void) | undefined

  return {
    get enabled() {
      return off !== undefined
    },

    enable(options = {}) {
      if (off) return

      sampling = Math.max(1, Math.floor(options.sampling ?? DEFAULT_SAMPLING))
      seen = 0

      off = instance.hooks.on('onTranslate', (data) => {
        // Отсчёт до подписки не сбрасывается: иначе при семплировании 1/N
        // первым всегда попадал бы N-й вызов после включения, а не случайный.
        if (++seen % sampling !== 0) return data

        counted++
        counts.set(data.key, (counts.get(data.key) ?? 0) + 1)

        return data
      })
    },

    disable() {
      off?.()
      off = undefined
    },

    reset() {
      counts.clear()
      counted = 0
      seen = 0
    },

    snapshot() {
      const raw = toRaw(instance.messages) as Record<Locale, MessageSchema>
      const dictionaryChars: Record<Locale, number> = {}

      for (const locale in raw) {
        dictionaryChars[locale] = JSON.stringify(raw[locale]).length
      }

      const topKeys = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_KEYS)
        .map(([key, count]) => ({ key, calls: count * sampling }))

      const slowestBlocks = blocks()
        .filter((block): block is BlockState & { duration: number } => typeof block.duration === 'number')
        .map(block => ({ block: block.block, locale: block.locale, duration: block.duration }))
        .sort((a, b) => b.duration - a.duration)

      return {
        enabled: off !== undefined,
        sampling,
        counted,
        calls: counted * sampling,
        distinctKeys: counts.size,
        topKeys,
        slowestBlocks,
        dictionaryChars,
        compiled: readCompiledCounts(instance),
      }
    },
  }
}
