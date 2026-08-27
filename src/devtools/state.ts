import { toRaw } from 'vue'
import type { FintI18n, Locale, MessageSchema } from '../core'
import {
  readCompiledCounts,
  readDisposed,
  readOptions,
  readPluginNames,
  readRegisteredBlocks,
  readUsageCounters,
} from './internals'
import type {
  BlockState,
  DevtoolsSnapshot,
  FallbackState,
  MissingKeyState,
  WarningState,
} from './types'

const blockKey = (locale: Locale, block: string) => `${locale}:${block}`

/** Листовые ключи поддерева. Набор плюральных форм считается одним ключом. */
function countLeaves(value: unknown): number {
  if (!value || typeof value !== 'object') return 1

  let total = 0
  for (const key in value as Record<string, unknown>) {
    total += countLeaves((value as Record<string, unknown>)[key])
  }

  return total
}

export interface ShadowState {
  blockLoadStarted: (block: string, locale: Locale) => void
  blockLoadFinished: (block: string, locale: Locale, resolvedAs: string) => void
  blockLoadFailed: (block: string | undefined, locale: Locale | undefined, error: unknown) => void
  blockUnloaded: (block: string, locale: Locale) => void
  usageChanged: (block: string, delta: number) => void
  /** Возвращает `true`, если ключ виден впервые: только такие идут в ленту. */
  missingKeySeen: (key: string, locale: Locale) => boolean
  fallbackSeen: (key: string, locale: Locale, fallbackLocale: Locale) => boolean
  warningSeen: (code: string, message: string, context?: Record<string, unknown>) => boolean
  snapshot: (instance: FintI18n, version: string, name: string) => DevtoolsSnapshot
}

export function createShadowState(): ShadowState {
  const blocks = new Map<string, BlockState>()
  const startedAt = new Map<string, number>()
  const usage = new Map<string, number>()
  const missingKeys = new Map<string, MissingKeyState>()
  const fallbacks = new Map<string, FallbackState>()
  const warnings = new Map<string, WarningState>()

  const upsert = (block: string, locale: Locale, patch: Partial<BlockState>): BlockState => {
    const key = blockKey(locale, block)
    const existing = blocks.get(key)
    const next: BlockState = existing
      ? Object.assign(existing, patch)
      : { block, locale, status: 'loading', ...patch }

    blocks.set(key, next)
    return next
  }

  /**
   * Загрузку открывает запрошенное имя, а закрывает фактически загруженное:
   * при восходящем резолвинге `pages.articles` отрабатывает лоадер `pages`.
   * Поэтому закрываем сначала по точному совпадению, а потом — по предку.
   */
  const takePending = (block: string, locale: Locale): { key: string, started: number } | null => {
    const exact = blockKey(locale, block)
    const started = startedAt.get(exact)
    if (started !== undefined) return { key: exact, started }

    const prefix = `${block}.`
    for (const [key, at] of startedAt) {
      const [pendingLocale, pendingBlock] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
      if (pendingLocale === locale && pendingBlock.startsWith(prefix)) return { key, started: at }
    }

    return null
  }

  return {
    blockLoadStarted(block, locale) {
      startedAt.set(blockKey(locale, block), Date.now())
      upsert(block, locale, { status: 'loading', error: undefined })
    },

    blockLoadFinished(block, locale, resolvedAs) {
      const pending = takePending(block, locale)
      const duration = pending ? Date.now() - pending.started : undefined
      if (pending) startedAt.delete(pending.key)

      const requested = pending ? pending.key.slice(pending.key.indexOf(':') + 1) : block
      upsert(requested, locale, {
        status: 'loaded',
        duration,
        resolvedAs: resolvedAs === requested ? undefined : resolvedAs,
        error: undefined,
      })
    },

    blockLoadFailed(block, locale, error) {
      if (!block || !locale) return

      const pending = takePending(block, locale)
      if (pending) startedAt.delete(pending.key)

      upsert(block, locale, {
        status: 'failed',
        duration: pending ? Date.now() - pending.started : undefined,
        error: error instanceof Error ? error.message : String(error),
      })
    },

    blockUnloaded(block, locale) {
      upsert(block, locale, { status: 'unloaded', duration: undefined })
    },

    usageChanged(block, delta) {
      const next = (usage.get(block) ?? 0) + delta
      if (next > 0) usage.set(block, next)
      else usage.delete(block)
    },

    missingKeySeen(key, locale) {
      const id = `${locale}:${key}`
      const existing = missingKeys.get(id)
      if (existing) {
        existing.count++
        return false
      }

      missingKeys.set(id, { key, locale, count: 1 })
      return true
    },

    fallbackSeen(key, locale, fallbackLocale) {
      const id = `${locale}:${key}`
      const existing = fallbacks.get(id)
      if (existing) {
        existing.count++
        return false
      }

      fallbacks.set(id, { key, locale, fallbackLocale, count: 1 })
      return true
    },

    warningSeen(code, message, context) {
      const id = `${code}:${message}`
      const existing = warnings.get(id)
      if (existing) {
        existing.count++
        return false
      }

      warnings.set(id, { code, message, context, count: 1 })
      return true
    },

    snapshot(instance, version, name) {
      // Словарь читается через `toRaw`: глубокое чтение `readonly(reactive())`
      // стоит ~889 нс против 5 нс у обычного объекта (аудит, 3.4).
      const raw = toRaw(instance.messages) as Record<Locale, MessageSchema>
      const messages: Record<Locale, Record<string, number>> = {}

      for (const locale in raw) {
        const perBlock: Record<string, number> = {}
        for (const block in raw[locale]) perBlock[block] = countLeaves(raw[locale][block])
        messages[locale] = perBlock
      }

      // Счётчики из инстанса точнее собственных: они видны и за то время,
      // пока devtools ещё не был подключён.
      const counters = readUsageCounters(instance)
      const usageSnapshot: Record<string, number> = counters ?? {}
      if (!counters) for (const [block, count] of usage) usageSnapshot[block] = count

      return {
        version,
        name,
        disposed: readDisposed(instance),
        locale: instance.locale.value,
        fallbackLocale: instance.fallbackLocale,
        knownLocales: instance.getKnownLocales(),
        availableLocales: instance.getAvailableLocales(),
        registeredBlocks: readRegisteredBlocks(instance),
        options: readOptions(instance),
        plugins: readPluginNames(instance),
        loadedBlocks: instance.getLoadedBlocks(),
        blocks: [...blocks.values()],
        usage: usageSnapshot,
        compiled: readCompiledCounts(instance),
        messages,
        missingKeys: [...missingKeys.values()],
        fallbacks: [...fallbacks.values()],
        warnings: [...warnings.values()],
      }
    },
  }
}
