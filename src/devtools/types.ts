import type { FintI18nPlugin, Locale, WarningCode } from '../core'

export type DevtoolsEventType =
  | 'init'
  | 'localeChange'
  | 'blockRequested'
  | 'blockLoadStart'
  | 'blockLoadEnd'
  | 'blockUnload'
  | 'messagesMerged'
  | 'loadersAdded'
  | 'usage'
  | 'missingKey'
  | 'fallback'
  | 'retry'
  | 'error'
  | 'warning'
  | 'dispose'

export interface DevtoolsEvent {
  id: number
  /** `Date.now()` в момент события. */
  at: number
  type: DevtoolsEventType
  payload?: unknown
}

export type BlockStatus = 'loading' | 'loaded' | 'failed' | 'unloaded'

export interface BlockState {
  block: string
  locale: Locale
  status: BlockStatus
  /**
   * Длительность последней загрузки, мс. Считается по паре
   * `beforeLoadBlock` → `afterLoadBlock`, сопоставляемой по блоку **и** локали,
   * поэтому верна и при `preloadFallback`, когда одно имя грузится сразу под две.
   */
  duration?: number
  /** Имя блока, который фактически отработал: при восходящем резолвинге это предок. */
  resolvedAs?: string
  error?: string
}

export interface MissingKeyState {
  key: string
  locale: Locale
  count: number
}

export interface FallbackState {
  key: string
  locale: Locale
  fallbackLocale: Locale
  count: number
}

export interface WarningState {
  code: WarningCode
  message: string
  context?: Record<string, unknown>
  count: number
}

/** Опции инстанса. `null`, если прочитать их не удалось. */
export interface InstanceOptions {
  fallbackLocale: string
  preloadFallback: boolean
  unloadUnusedBlocks: boolean
  retry: unknown
}

export interface DevtoolsSnapshot {
  /** Версия пакета. Две разные версии в одном рантайме делят `Symbol.for('FintI18n')`. */
  version: string
  name: string
  disposed: boolean
  locale: Locale
  fallbackLocale: string
  knownLocales: readonly Locale[]
  availableLocales: Locale[]
  /** Имена блоков из реестра лоадеров; `null`, если реестр прочитать не удалось. */
  registeredBlocks: string[] | null
  options: InstanceOptions | null
  plugins: string[] | null
  loadedBlocks: Record<Locale, string[]>
  blocks: BlockState[]
  /** Счётчик использований по имени блока — он общий для всех локалей. */
  usage: Record<string, number>
  /** Сколько ключей скомпилировано, по локалям. `null`, если кэш недоступен. */
  compiled: Record<Locale, number> | null
  /** Сколько листовых ключей в словаре, по локалям и корневым блокам. */
  messages: Record<Locale, Record<string, number>>
  missingKeys: MissingKeyState[]
  fallbacks: FallbackState[]
  warnings: WarningState[]
}

export interface DevtoolsOptions {
  /** Имя инстанса в мосте и в панели. По умолчанию `i18n`, при совпадении — с индексом. */
  name?: string
  /** Сколько событий держать в ленте. По умолчанию 200. */
  eventLimit?: number
  /** Не публиковать инстанс в `window.__FINT_I18N_DEVTOOLS__`. */
  bridge?: boolean
}

export interface FintI18nDevtools extends FintI18nPlugin {
  /** Снимок состояния на момент вызова. */
  snapshot: () => DevtoolsSnapshot
  /** Лента событий, новые в конце. */
  readonly events: readonly DevtoolsEvent[]
  subscribe: (listener: (event: DevtoolsEvent) => void) => () => void
  clearEvents: () => void
  /** Отцепиться, не трогая инстанс: снять подписки, вернуть обёрнутые методы. */
  detach: () => void
}
