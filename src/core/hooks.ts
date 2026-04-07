import type { Locale } from './types'

export type HookFn<T = any> = (arg: T) => void | T | Promise<void | T>

type HookPayload<K extends keyof FintI18nHooks> = Parameters<FintI18nHooks[K]>[0]

export interface FintI18nHooks {
  'beforeInit': HookFn<any>
  'afterInit': HookFn<void>
  'onLocaleChange': HookFn<{ locale: Locale, previous: Locale }>
  'beforeLoadBlock': HookFn<string>
  'afterLoadBlock': HookFn<{ block: string, locale: Locale, messages: any }>
  'onMissingKey': HookFn<{ key: string, locale: Locale }>
  'onTranslate': HookFn<{ key: string, params?: any, result: string | undefined }>
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
