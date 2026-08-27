import type { FintI18nPlugin, Locale, WarningCode } from '../core'
import type { DevtoolsActions } from './actions'
import type { DevtoolsMetrics } from './metrics'
import type { DevtoolsMode } from './modes'
import type { DevServerBridge } from './dev-server'
import type { DevtoolsSimulator } from './simulator'

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
  | 'mode'
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

export interface DictionaryEntry {
  key: string
  /** Значение по локалям; отсутствие ключа в локали — отсутствие поля. */
  values: Record<Locale, string>
  /**
   * Можно ли править значение строкой. Набор плюральных форм и сообщение-функция
   * — нельзя: строка заменила бы их целиком.
   */
  editable: boolean
}

export interface OverlayOptions {
  /** Горячая клавиша показать/скрыть. По умолчанию `alt+i`. */
  hotkey?: string | false
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Начинать свёрнутым — значком вместо панели. */
  collapsed?: boolean
  /**
   * Где хранить положение и размер панели между перезагрузками. `false` — не
   * хранить. По умолчанию `localStorage`, если он доступен.
   */
  storage?: Storage | false
}

export interface DevtoolsOptions {
  /** Имя инстанса в мосте и в панели. По умолчанию `i18n`, при совпадении — с индексом. */
  name?: string
  /** Сколько событий держать в ленте. По умолчанию 200. */
  eventLimit?: number
  /** Не публиковать инстанс в `window.__FINT_I18N_DEVTOOLS__`. */
  bridge?: boolean
  /** Путь к эндпоинту плагина dev-сервера. По умолчанию `/__fint-i18n/messages`. */
  devServerEndpoint?: string
}

export interface FintI18nDevtools extends FintI18nPlugin {
  /** Снимок состояния на момент вызова. */
  snapshot: () => DevtoolsSnapshot
  /** Лента событий, новые в конце. */
  readonly events: readonly DevtoolsEvent[]
  subscribe: (listener: (event: DevtoolsEvent) => void) => () => void
  clearEvents: () => void
  /**
   * Плоский словарь: ключ и его значения по локалям. Отдельно от снимка,
   * потому что на большом приложении это десятки тысяч строк.
   */
  dictionary: () => DictionaryEntry[]
  /**
   * Какие блоки попросил конкретный компонент. Знание есть только у devtools:
   * счётчики инстанса считают блоки, но не тех, кто их попросил.
   */
  componentBlocks: (component: object) => { name: string, blocks: string[] } | null
  /** Write-операции: всё через публичный API инстанса. */
  readonly actions: DevtoolsActions
  /**
   * Режим вывода `t()`. Пока он не `off`, у `onTranslate` есть подписчик, и
   * каждый перевод стоит на ~17 % дороже — поэтому по умолчанию режима нет.
   */
  readonly mode: DevtoolsMode
  setMode: (mode: DevtoolsMode) => void
  /**
   * Счётчики вызовов `t()`. Сбор выключен по умолчанию и включается вручную:
   * пока он идёт, у `onTranslate` есть подписчик, а это ~17 % к каждому переводу.
   */
  readonly metrics: DevtoolsMetrics
  /**
   * Симулятор отказов и задержек лоадеров: единственный способ увидеть пути
   * `ready`/`error` и повторы в живом приложении, а не в юнит-тесте.
   */
  readonly simulator: DevtoolsSimulator
  /**
   * Клиент к плагину dev-сервера: записывает ключи в словари на диске.
   * Без плагина `probe()` вернёт `false`, и панель не покажет кнопок записи.
   */
  readonly devServer: DevServerBridge
  /** Отцепиться, не трогая инстанс: снять подписки, вернуть обёрнутые методы. */
  detach: () => void
}
