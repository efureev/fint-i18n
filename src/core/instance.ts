import { reactive, ref, type Ref, watch } from 'vue'
import { compileTemplate, type MessageFunction } from './compiler'
import { HookManager } from './hooks'
import { isBlockPattern, LocaleLoaderRegistry } from './loader-registry'
import { deepMerge, getMessageValue, isMessageObject, mergeMessageValues } from './message-utils'
import { normalizeTranslateParams } from './translate-params'
import type { FintI18nOptions, Locale, MessageValue, TranslateOptions } from './types'

export class FintI18n {
  public locale: Ref<Locale>
  public fallbackLocale: Locale
  public globalInstall: boolean
  public readonly messages: Record<Locale, any> = reactive({})
  private compiledMessages: Record<Locale, Record<string, MessageFunction>> = Object.create(null)
  private readonly loaderRegistry: LocaleLoaderRegistry
  private loadingBlocks: Map<string, Promise<void>> = new Map()
  private loadedBlocks: Map<Locale, Set<string>> = new Map()
  private blockUsageCounters: Map<string, number> = new Map()
  // Кэш развёртки wildcard-паттернов: pattern → конкретные имена блоков.
  // Кэшируется один раз (при первом обращении), т.к. набор лоадеров неизменен после конструктора.
  private patternExpansionCache: Map<string, string[]> = new Map()
  private pendingUsedBlockLoads: Map<Locale, Promise<void>> = new Map()
  private skipNextUsedBlockLoadLocale: Locale | null = null

  public hooks = new HookManager()

  constructor(options: FintI18nOptions) {
    this.locale = ref(options.locale)
    this.fallbackLocale = options.fallbackLocale || ''
    this.loaderRegistry = new LocaleLoaderRegistry(options.loaders)
    this.globalInstall = options.globalInstall !== false

    if (options.plugins) {
      options.plugins.forEach(p => p.install(this))
    }

    // Следим за изменением локали для автоматической подгрузки блоков
    watch(this.locale, (newLocale, oldLocale) => {
      if (newLocale !== oldLocale) {
        if (this.skipNextUsedBlockLoadLocale === newLocale) {
          this.skipNextUsedBlockLoadLocale = null
          return
        }

        void this.loadUsedBlocks(newLocale)
      }
    })

    this.hooks.emitSync('afterInit', undefined)
  }


  public t = (key: string, params?: Record<string, any>, options?: TranslateOptions): string => {
    const locale = this.locale.value
    const cleanParams = normalizeTranslateParams(params)

    const data = this.hooks.emitSync('onTranslate', {
      key,
      params: cleanParams,
      result: this.resolve(locale, key, cleanParams)
    })

    const result = data.result ?? key

    if (result === key) {
      const fallbackLocale = options?.fallbackLocale || this.fallbackLocale
      if (fallbackLocale && fallbackLocale !== locale) {
        const fallbackResult = this.resolve(fallbackLocale, key, cleanParams)
        if (fallbackResult !== undefined) {
          return fallbackResult
        }
      }

      this.hooks.emit('onMissingKey', { key, locale }).catch(err => {
        console.error('[fint-i18n] Error in onMissingKey hook:', err)
      })
    }
    return result
  }

  private resolve = (locale: Locale, key: string, params?: Record<string, any>): string | undefined => {
    const compiled = this.compiledMessages[locale]?.[key]
    if (compiled) {
      return compiled(params)
    }

    const messages = this.messages[locale]
    if (!messages) return undefined

    const current = getMessageValue(messages, key)

    if (typeof current === 'string') {
      const fn = compileTemplate(current)
      this.setCompiled(locale, key, fn)
      return fn(params)
    }

    if (typeof current === 'function') {
      const fn = current as MessageFunction
      this.setCompiled(locale, key, fn)
      return fn(params)
    }

    if (current !== undefined && current !== null && typeof current !== 'object') {
      return String(current)
    }

    return undefined
  }

  private setCompiled = (locale: Locale, key: string, fn: MessageFunction) => {
    if (!this.compiledMessages[locale]) this.compiledMessages[locale] = Object.create(null)
    this.compiledMessages[locale][key] = fn
  }

  /**
   * Развернуть wildcard-паттерн в список конкретных имён блоков.
   * Результат кэшируется по строке паттерна (набор лоадеров неизменен).
   * Не-паттерны возвращают пустой массив.
   */
  private expandPattern = (pattern: string): string[] => {
    const cached = this.patternExpansionCache.get(pattern)
    if (cached) return cached

    const expanded = this.loaderRegistry.expandPattern(pattern)
    this.patternExpansionCache.set(pattern, expanded)
    return expanded
  }

  public loadBlock = async (blockName: string, locale?: Locale): Promise<void> => {
    const targetLocale = locale || this.locale.value

    // Wildcard-паттерн: разворачиваем и грузим конкретные блоки параллельно.
    if (isBlockPattern(blockName)) {
      const expanded = this.expandPattern(blockName)
      if (expanded.length === 0) {
        console.warn(
          `[fint-i18n] Pattern "${blockName}" did not match any registered block (locale "${targetLocale}")`,
        )
        return
      }
      await Promise.all(expanded.map(name => this.loadBlock(name, targetLocale)))
      return
    }

    const loadKey = `${targetLocale}:${blockName}`

    if (this.isBlockLoaded(blockName, targetLocale)) return
    if (this.loadingBlocks.has(loadKey)) return this.loadingBlocks.get(loadKey)

    await this.hooks.emit('beforeLoadBlock', blockName)

    const promise = (async () => {
      try {
        const resolvedLoaders = this.loaderRegistry.resolve(targetLocale, blockName)

        if (!resolvedLoaders) {
          console.warn(`[fint-i18n] No loader for block "${blockName}" in locale "${targetLocale}"`)
          return
        }

        let loadedMessages: MessageValue | undefined

        for (const loader of resolvedLoaders.loaders) {
          const module = await loader()
          const messages = (module.default || module) as MessageValue

          this.mergeMessages(targetLocale, resolvedLoaders.resolvedBlockName, messages)
          loadedMessages = loadedMessages === undefined
            ? messages
            : mergeMessageValues(loadedMessages, messages)
        }

        this.markBlockLoaded(resolvedLoaders.resolvedBlockName, targetLocale)

        await this.hooks.emit('afterLoadBlock', {
          block: resolvedLoaders.resolvedBlockName,
          locale: targetLocale,
          messages: loadedMessages,
        })
      }
      finally {
        this.loadingBlocks.delete(loadKey)
      }
    })()

    this.loadingBlocks.set(loadKey, promise)
    return promise
  }

  public mergeMessages = (locale: Locale, blockName: string, messages: MessageValue) => {
    if (!this.messages[locale]) {
      this.messages[locale] = reactive({})
    }

    const path = blockName.split('.')
    const rootBlockName = path[0]

    if (path.length === 1) {
      if (isMessageObject(messages)) {
        if (!this.messages[locale][rootBlockName] || typeof this.messages[locale][rootBlockName] !== 'object') {
          this.messages[locale][rootBlockName] = reactive({})
        }
        deepMerge(this.messages[locale][rootBlockName], messages)
      }
      else {
        this.messages[locale][rootBlockName] = messages
      }
    }
    else {
      if (!this.messages[locale][rootBlockName] || typeof this.messages[locale][rootBlockName] !== 'object') {
        this.messages[locale][rootBlockName] = reactive({})
      }

      let target = this.messages[locale][rootBlockName]
      for (let i = 1; i < path.length; i++) {
        const subKey = path[i]
        if (!target[subKey] || typeof target[subKey] !== 'object') {
          target[subKey] = reactive({})
        }
        target = target[subKey]
      }

      deepMerge(target, messages)
    }

    this.precompileBlock(locale, blockName, messages)
  }

  private precompileBlock = (locale: Locale, fullKey: string, messages: MessageValue) => {
    if (typeof messages === 'string') {
      const fn = compileTemplate(messages)
      this.setCompiled(locale, fullKey, fn)
      return
    }

    if (typeof messages === 'function') {
      this.setCompiled(locale, fullKey, messages)
      return
    }

    if (!isMessageObject(messages)) return

    for (const key in messages) {
      const value = messages[key]
      const nestedKey = `${fullKey}.${key}`

      if (typeof value === 'string') {
        const fn = compileTemplate(value)
        this.setCompiled(locale, nestedKey, fn)
      }
      else if (typeof value === 'function') {
        this.setCompiled(locale, nestedKey, value)
      }
      else if (isMessageObject(value)) {
        this.precompileBlock(locale, nestedKey, value)
      }
    }
  }

  public isBlockLoaded = (blockName: string, locale?: Locale): boolean => {
    const targetLocale = locale || this.locale.value
    const loadedSet = this.loadedBlocks.get(targetLocale)
    if (!loadedSet) return false

    if (loadedSet.has(blockName)) return true

    // Check parent blocks (e.g. if 'pages' is loaded, 'pages.articles' is also loaded)
    const path = blockName.split('.')
    let parent = ''
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent ? `${parent}.${path[i]}` : path[i]
      if (loadedSet.has(parent)) return true
    }

    return false
  }

  public markBlockLoaded = (blockName: string, locale: Locale) => {
    if (!this.loadedBlocks.has(locale)) {
      this.loadedBlocks.set(locale, new Set())
    }
    this.loadedBlocks.get(locale)!.add(blockName)
  }

  public loadUsedBlocks = async (locale: Locale): Promise<void> => {
    const pendingLoad = this.pendingUsedBlockLoads.get(locale)
    if (pendingLoad) {
      await pendingLoad
      return
    }

    const loadPromise = (async () => {
      const promises: Promise<void>[] = []
      for (const [blockName, count] of this.blockUsageCounters.entries()) {
        if (count > 0) {
          promises.push(this.loadBlock(blockName, locale))
        }
      }
      await Promise.all(promises)
    })()

    this.pendingUsedBlockLoads.set(locale, loadPromise)

    try {
      await loadPromise
    }
    finally {
      this.pendingUsedBlockLoads.delete(locale)
    }
  }

  public setLocale = async (newLocale: Locale): Promise<void> => {
    const previous = this.locale.value
    if (previous === newLocale) return

    await this.loadUsedBlocks(newLocale)
    this.skipNextUsedBlockLoadLocale = newLocale
    this.locale.value = newLocale
    this.hooks.emitSync('onLocaleChange', { locale: newLocale, previous })
  }

  /**
   * Зарегистрировать использование блока.
   *
   * Поддерживается wildcard-паттерн (`prefix.*`, `prefix.**`) — он разворачивается в
   * конкретные имена зарегистрированных блоков (один раз, с кэшированием), и счётчик
   * увеличивается для каждого из них. Если паттерн не дал совпадений — выводится warning.
   */
  public registerUsage = (blockName: string) => {
    if (isBlockPattern(blockName)) {
      const expanded = this.expandPattern(blockName)
      if (expanded.length === 0) {
        console.warn(`[fint-i18n] Pattern "${blockName}" did not match any registered block`)
        return
      }
      for (let i = 0; i < expanded.length; i++) {
        this.incrementUsage(expanded[i])
      }
      return
    }

    this.incrementUsage(blockName)
  }

  public registerBlocks = (blockNames: string[]) => {
    for (let i = 0; i < blockNames.length; i++) {
      this.registerUsage(blockNames[i])
    }
  }

  /**
   * Снять регистрацию использования блока.
   * Wildcard-паттерн раскрывается тем же кэшем, что и в `registerUsage`,
   * поэтому снимаются счётчики ровно у тех же child-блоков.
   */
  public unregisterUsage = (blockName: string) => {
    if (isBlockPattern(blockName)) {
      const expanded = this.expandPattern(blockName)
      for (let i = 0; i < expanded.length; i++) {
        this.decrementUsage(expanded[i])
      }
      return
    }

    this.decrementUsage(blockName)
  }

  private incrementUsage = (blockName: string) => {
    const count = this.blockUsageCounters.get(blockName) || 0
    this.blockUsageCounters.set(blockName, count + 1)
  }

  private decrementUsage = (blockName: string) => {
    const count = this.blockUsageCounters.get(blockName) || 0
    if (count <= 1) {
      this.blockUsageCounters.delete(blockName)
    }
    else {
      this.blockUsageCounters.set(blockName, count - 1)
    }
  }

}

export function createFintI18n(options: FintI18nOptions): FintI18n {
  return new FintI18n(options)
}
