import type { Locale } from './types'

export type HookFn<T = any> = (arg: T) => void | T | Promise<void | T>

type HookPayload<K extends keyof FintI18nHooks> = Parameters<FintI18nHooks[K]>[0]

export interface FintI18nHooks {
  /** Эмитится синхронно в конце конструктора — подписаться успевают только плагины. */
  'afterInit': HookFn<void>
  'onLocaleChange': HookFn<{ locale: Locale, previous: Locale }>
  'beforeLoadBlock': HookFn<{ block: string, locale: Locale }>
  'afterLoadBlock': HookFn<{ block: string, locale: Locale, messages: any }>
  'onMissingKey': HookFn<{ key: string, locale: Locale }>
  'onTranslate': HookFn<{ key: string, params?: any, result: string | undefined }>
  /** Перевод разрешён запасной локалью: в текущей ключа нет. */
  'onFallback': HookFn<{ key: string, locale: Locale, fallbackLocale: Locale }>
  /**
   * Отказ лоадера, после которого будет ещё попытка. Итоговый отказ приходит
   * не сюда, а в `onError`.
   */
  'onRetry': HookFn<{ block: string, locale: Locale, attempt: number, error: unknown }>
  /** Ошибки асинхронной загрузки блоков. Без подписчиков — console.error. */
  'onError': HookFn<{ error: unknown, block?: string, locale?: Locale }>
  /**
   * Проблемы конфигурации, а не рантайма: нет лоадера, паттерн ничего не
   * развернул, сохранённая локаль не опознана. Без подписчиков — console.warn.
   */
  'onWarning': HookFn<{ code: WarningCode, message: string, context?: Record<string, unknown> }>
}

/**
 * Коды предупреждений. Существуют затем, чтобы подписчик различал случаи
 * машинно, а не разбором текста сообщения.
 *
 * Произвольная строка допустима намеренно: плагин шлёт в тот же канал свои
 * предупреждения со своими кодами, и запирать его в список библиотеки незачем.
 * Ценой исчерпывающего `switch` — как и у `MessageKey`.
 */
export type WarningCode =
  | 'no-loader'
  | 'pattern-no-match'
  | 'scope-prefix-ignored'
  | 'persisted-locale-unknown'
  | 'ssr-function-messages'
  | 'deprecated-locale-setter'
  | (string & {})

/**
 * Единственный путь предупреждения наружу. Консоль остаётся ровно там, где
 * подписчика нет, — иначе приложение, подписавшееся на канал, получало бы
 * каждое предупреждение дважды.
 *
 * Предупреждения `plural.ts` и `format.ts` сюда не идут: их кэши модульные, до
 * инстанса оттуда не дотянуться.
 */
export function warn(
  hooks: HookManager,
  code: WarningCode,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (hooks.has('onWarning')) {
    hooks.emitSync('onWarning', { code, message, context })
    return
  }

  console.warn(`[fint-i18n] ${message}`)
}

export class HookManager {
  private hooks: Map<keyof FintI18nHooks, HookFn[]> = new Map()

  on<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): () => void {
    const hooks = this.hooks.get(name)

    if (hooks) {
      hooks.push(fn)
    }
    else {
      this.hooks.set(name, [fn])
    }

    return () => this.off(name, fn)
  }

  has<K extends keyof FintI18nHooks>(name: K): boolean {
    const hooks = this.hooks.get(name)
    return !!hooks && hooks.length > 0
  }

  /** Снять все подписки разом. Используется в `FintI18n.dispose()`. */
  clear(): void {
    this.hooks.clear()
  }

  off<K extends keyof FintI18nHooks>(name: K, fn: FintI18nHooks[K]): void {
    const hooks = this.hooks.get(name)
    if (hooks) {
      const index = hooks.indexOf(fn)
      if (index !== -1) {
        hooks.splice(index, 1)

        if (hooks.length === 0) {
          this.hooks.delete(name)
        }
      }
    }
  }

  emit<K extends keyof FintI18nHooks>(name: K, arg: HookPayload<K>): Promise<HookPayload<K>> {
    const hooks = this.hooks.get(name)
    if (!hooks || hooks.length === 0) return Promise.resolve(arg)

    let currentArg = arg
    const hookQueue = hooks.slice()

    const runHooks = async () => {
      for (const hook of hookQueue) {
        const result = await hook(currentArg)
        if (result !== undefined) {
          currentArg = result
        }
      }
      return currentArg
    }

    return runHooks()
  }

  emitSync<K extends keyof FintI18nHooks>(name: K, arg: HookPayload<K>): HookPayload<K> {
    const hooks = this.hooks.get(name)
    if (!hooks || hooks.length === 0) return arg

    let currentArg = arg
    const hookQueue = hooks.slice()

    for (const hook of hookQueue) {
      const result = hook(currentArg)
      if (result instanceof Promise) {
        console.warn(`[fint-i18n] Sync hook "${name}" received a promise from handler. This will be ignored in sync execution.`)
        continue
      }
      if (result !== undefined) {
        currentArg = result
      }
    }
    return currentArg
  }
}
