import type { DevtoolsEvent, DevtoolsSnapshot, FintI18nDevtools } from './types'

export const BRIDGE_KEY = '__FINT_I18N_DEVTOOLS__'

interface BridgeEntry {
  name: string
  ref: WeakRef<FintI18nDevtools>
}

export interface DevtoolsBridge {
  version: string
  /** Имена живых инстансов. */
  list: () => string[]
  snapshot: (name?: string) => DevtoolsSnapshot | null
  events: (name?: string) => readonly DevtoolsEvent[]
  /**
   * Дождаться загрузки блока — то, ради чего мост вообще нужен в e2e:
   * иначе тест ждёт текст, а не событие.
   */
  waitFor: (block: string, locale?: string, options?: { name?: string, timeout?: number }) => Promise<void>
}

interface BridgeInternals extends DevtoolsBridge {
  entries: BridgeEntry[]
}

const DEFAULT_TIMEOUT = 5000

function resolve(entries: BridgeEntry[], name?: string): FintI18nDevtools | null {
  for (let i = entries.length - 1; i >= 0; i--) {
    const devtools = entries[i].ref.deref()
    // Инстанс собран сборщиком — запись держать незачем.
    if (!devtools) {
      entries.splice(i, 1)
      continue
    }
    if (name === undefined || entries[i].name === name) return devtools
  }

  return null
}

function createBridge(version: string): BridgeInternals {
  const entries: BridgeEntry[] = []

  return {
    version,
    entries,

    list() {
      resolve(entries)
      return entries.map(entry => entry.name)
    },

    snapshot(name) {
      return resolve(entries, name)?.snapshot() ?? null
    },

    events(name) {
      return resolve(entries, name)?.events ?? []
    },

    waitFor(block, locale, options = {}) {
      const devtools = resolve(entries, options.name)
      if (!devtools) return Promise.reject(new Error(`[fint-i18n] devtools instance not found`))

      const loaded = devtools.snapshot().loadedBlocks
      const already = locale
        ? loaded[locale]?.includes(block)
        : Object.values(loaded).some(names => names.includes(block))
      if (already) return Promise.resolve()

      const timeout = options.timeout ?? DEFAULT_TIMEOUT

      return new Promise<void>((resolvePromise, reject) => {
        let stop: (() => void) | undefined

        const timer = setTimeout(() => {
          stop?.()
          reject(new Error(`[fint-i18n] block "${block}" was not loaded in ${timeout}ms`))
        }, timeout)

        stop = devtools.subscribe((event) => {
          if (event.type !== 'blockLoadEnd') return

          const payload = event.payload as { block: string, locale: string }
          if (payload.block !== block) return
          if (locale !== undefined && payload.locale !== locale) return

          clearTimeout(timer)
          stop?.()
          resolvePromise()
        })
      })
    },
  }
}

/**
 * Публикация инстанса в `window`. Единственный побочный эффект модуля, и он
 * происходит из явного вызова — `sideEffects: false` держится.
 *
 * Без `window` (SSR, node-прогон тестов) не делает ничего: глобальный объект
 * сервера пачкать нечем и незачем.
 */
export function publishToBridge(
  name: string,
  devtools: FintI18nDevtools,
  version: string,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const host = window as unknown as Record<string, BridgeInternals | undefined>
  const bridge = host[BRIDGE_KEY] ?? createBridge(version)
  host[BRIDGE_KEY] = bridge

  const entry: BridgeEntry = { name, ref: new WeakRef(devtools) }
  bridge.entries.push(entry)

  return () => {
    const index = bridge.entries.indexOf(entry)
    if (index !== -1) bridge.entries.splice(index, 1)
  }
}

/** Свободно ли имя в мосте — чтобы два инстанса не отвечали на одно и то же. */
export function isNameTaken(name: string): boolean {
  if (typeof window === 'undefined') return false

  const bridge = (window as unknown as Record<string, BridgeInternals | undefined>)[BRIDGE_KEY]
  if (!bridge) return false

  return bridge.list().includes(name)
}
