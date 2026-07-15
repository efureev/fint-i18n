import type { FintI18n, FintI18nHooks, FintI18nPlugin } from '../core'

type LoggerFn = (message?: any, ...optionalParams: any[]) => void
type HookName = keyof FintI18nHooks
type HookPayload<K extends HookName> = Parameters<FintI18nHooks[K]>[0]

export interface HookLoggerPluginOptions {
  logger?: LoggerFn
  prefix?: string
}

const hookNames: HookName[] = [
  'afterInit',
  'onLocaleChange',
  'beforeLoadBlock',
  'afterLoadBlock',
  'onMissingKey',
  'onTranslate',
  'onError'
]

export class HookLoggerPlugin implements FintI18nPlugin {
  public name = 'hook-logger'
  private options: Required<HookLoggerPluginOptions>
  private hookUnsubscribers: (() => void)[] = []

  constructor(options: HookLoggerPluginOptions = {}) {
    this.options = {
      logger: console.log,
      prefix: '[fint-i18n] Hook',
      ...options
    }
  }

  install(i18n: FintI18n) {
    hookNames.forEach(hookName => this.registerHook(i18n, hookName))
  }

  uninstall() {
    this.hookUnsubscribers.forEach(off => off())
    this.hookUnsubscribers = []
  }

  private registerHook<K extends HookName>(i18n: FintI18n, hookName: K) {
    const logHook = (payload: HookPayload<K>) => {
      this.options.logger(`${this.options.prefix} "${hookName}" called`, payload)
      return payload
    }
    this.hookUnsubscribers.push(i18n.hooks.on(hookName, logHook as FintI18nHooks[K]))
  }
}
