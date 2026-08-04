import { computed, reactive, readonly, ref, type Ref, type WritableComputedRef } from 'vue'
import { compileTemplate, type MessageFunction } from './compiler'
import { HookManager } from './hooks'
import { isBlockPattern, LocaleLoaderRegistry } from './loader-registry'
import { deepMerge, getMessageValue, isMessageObject, mergeMessageValues } from './message-utils'
import { compilePluralForms, isPluralForms } from './plural'
import { normalizeTranslateParams } from './translate-params'
import type { FintI18nOptions, FintI18nPlugin, Locale, LocaleBlockLoader, LocaleLoaderSource, MessageKey, MessageSchema, MessageSchemaConstraint, MessageValue, RetryOptions, TranslateOptions } from './types'

function rootSegment(key: string): string {
  const dot = key.indexOf('.')
  return dot === -1 ? key : key.slice(0, dot)
}

const DEFAULT_RETRY_ATTEMPTS = 3

/** 100, 200, 400… — экспоненциальная пауза по умолчанию. */
function defaultBackoff(attempt: number): number {
  return 100 * 2 ** (attempt - 1)
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Ограничение ожидания. Таймер обязательно снимается: незакрытый `setTimeout`
 * держит процесс живым, и на сервере это заметно сразу.
 */
function withTimeout<T>(promise: Promise<T>, ms?: number): Promise<T> {
  if (!ms) return promise

  let timer: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`[fint-i18n] Loader timed out after ${ms}ms`)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export class FintI18n<Schema extends MessageSchemaConstraint = any> {
  /**
   * Текущая локаль. Чтение реактивно.
   * Прямая запись в `.value` устарела: она делегирует в `setLocale()` —
   * используйте `setLocale()` напрямую.
   */
  public readonly locale: WritableComputedRef<Locale>
  public fallbackLocale: Locale
  private readonly messagesStore: Record<Locale, any> = reactive({})
  /** Read-only представление словарей. Изменение — только через `mergeMessages()`. */
  public readonly messages: Readonly<Record<Locale, MessageSchema>> = readonly(this.messagesStore)
  private readonly localeRef: Ref<Locale>
  private readonly preloadFallback: boolean
  private readonly unloadUnusedBlocks: boolean
  private readonly retry?: RetryOptions
  private compiledMessages: Record<Locale, Record<string, MessageFunction>> = Object.create(null)
  // Индекс «локаль → корневой блок → его скомпилированные ключи».
  // Существует только ради адресной инвалидации, на чтение перевода не влияет.
  private compiledKeysByRoot: Map<Locale, Map<string, Set<string>>> = new Map()
  private readonly loaderRegistry: LocaleLoaderRegistry
  private loadingBlocks: Map<string, Promise<void>> = new Map()
  private loadedBlocks: Map<Locale, Set<string>> = new Map()
  private blockUsageCounters: Map<string, number> = new Map()
  // Кэш развёртки wildcard-паттернов: pattern → конкретные имена блоков.
  // Сбрасывается при регистрации новых лоадеров через addLoaders().
  private patternExpansionCache: Map<string, string[]> = new Map()
  private pendingUsedBlockLoads: Map<Locale, Promise<void>> = new Map()
  // Монотонный счётчик переключений локали: при конкурентных setLocale()
  // применяется только последний запрошенный переход.
  private localeEpoch = 0
  private missingKeyReported: Set<string> = new Set()
  private localeSetterWarned = false
  private disposed = false
  private readonly installedPlugins: FintI18nPlugin[] = []

  public hooks = new HookManager()

  constructor(options: FintI18nOptions) {
    this.localeRef = ref(options.locale)
    this.locale = computed({
      get: () => this.localeRef.value,
      set: (value: Locale) => {
        if (!this.localeSetterWarned) {
          this.localeSetterWarned = true
          console.warn('[fint-i18n] Direct assignment to `locale.value` is deprecated, use `setLocale()` instead')
        }
        void this.setLocale(value)
      },
    })
    this.fallbackLocale = options.fallbackLocale || ''
    this.preloadFallback = options.preloadFallback ?? false
    this.unloadUnusedBlocks = options.unloadUnusedBlocks ?? false
    this.retry = options.retry
    this.loaderRegistry = new LocaleLoaderRegistry(options.loaders)

    if (options.plugins) {
      options.plugins.forEach((p) => {
        p.install(this)
        this.installedPlugins.push(p)
      })
    }

    this.hooks.emitSync('afterInit', undefined)
  }

  /**
   * Освободить инстанс: снять плагины и все подписки, очистить словари,
   * кэши компиляции и учёт блоков.
   *
   * После вызова `t()` возвращает ключи — сообщений больше нет. Загрузки,
   * запущенные до вызова, домержиться уже не смогут: инстанс помечен
   * освобождённым, и их результат отбрасывается.
   */
  public dispose = (): void => {
    this.disposed = true

    // Плагины снимаются до `hooks.clear()`, чтобы их `uninstall` отработал
    // штатно, а не по уже пустому реестру подписок.
    for (const plugin of this.installedPlugins) {
      plugin.uninstall?.(this)
    }
    this.installedPlugins.length = 0
    this.hooks.clear()

    // `messagesStore` реактивен и наружу отдан как `readonly`, поэтому
    // очищается по ключам, а не переприсваиванием.
    for (const locale in this.messagesStore) {
      delete this.messagesStore[locale]
    }

    this.compiledMessages = Object.create(null)
    this.compiledKeysByRoot.clear()
    this.loadedBlocks.clear()
    this.loadingBlocks.clear()
    this.pendingUsedBlockLoads.clear()
    this.blockUsageCounters.clear()
    this.patternExpansionCache.clear()
    this.missingKeyReported.clear()
  }

  /**
   * Зарегистрировать дополнительные лоадеры после создания инстанса
   * (микрофронтенды, динамически подключаемые модули).
   */
  public addLoaders = (source: LocaleLoaderSource): void => {
    this.loaderRegistry.add(source)
    this.patternExpansionCache.clear()
  }

  /** Локали, известные из зарегистрированных лоадеров. */
  public getKnownLocales = (): readonly Locale[] => this.loaderRegistry.getKnownLocales()

  /**
   * Локали, на которые вообще можно переключиться: объединение
   * зарегистрированных лоадеров и локалей, для которых сообщения уже
   * смержены. Отличается от `getKnownLocales()` ровно этим вторым слагаемым —
   * приложение, задающее словари через `mergeMessages()`, лоадеров не имеет.
   *
   * Чтение реактивно: вызов внутри `computed`/рендера пересчитается, когда
   * появится новая локаль.
   */
  public getAvailableLocales = (): Locale[] => {
    const locales = new Set<Locale>(this.loaderRegistry.getKnownLocales())

    for (const locale in this.messagesStore) locales.add(locale)

    return [...locales]
  }

  /**
   * Есть ли перевод для ключа. Единственный честный способ это спросить:
   * сравнение `t(key) !== key` врёт на сообщении, значение которого совпадает
   * с его собственным ключом.
   *
   * Без явной локали проверяется то же, что разрешил бы `t()`: текущая локаль,
   * затем `fallbackLocale`.
   */
  public te = (key: MessageKey<Schema>, locale?: Locale): boolean => {
    if (locale !== undefined) return this.hasMessage(locale, key)

    const current = this.localeRef.value
    if (this.hasMessage(current, key)) return true

    return Boolean(this.fallbackLocale)
      && this.fallbackLocale !== current
      && this.hasMessage(this.fallbackLocale, key)
  }

  /**
   * Сырое поддерево сообщений — когда переводы нужны как данные: пункты меню,
   * колонки таблицы, списки.
   *
   * Отдаётся `readonly`: мутация в обход `mergeMessages()` не инвалидировала бы
   * кэш компиляции. Для листа возвращается `undefined` — лист читается через
   * `t()`; набор плюральных форм тоже лист, хотя и объект.
   */
  public tm = (key: MessageKey<Schema>, locale?: Locale): Readonly<MessageSchema> | undefined => {
    const subtree = locale !== undefined
      ? this.subtree(locale, key)
      : this.subtree(this.localeRef.value, key)
        ?? (this.fallbackLocale && this.fallbackLocale !== this.localeRef.value
          ? this.subtree(this.fallbackLocale, key)
          : undefined)

    return subtree && readonly(subtree)
  }

  private subtree = (locale: Locale, key: string): MessageSchema | undefined => {
    const messages = this.messagesStore[locale]
    if (!messages) return undefined

    const value = getMessageValue(messages, key)

    return isMessageObject(value) && !isPluralForms(value) ? value : undefined
  }

  /**
   * Разрешим ли ключ в этой локали. Правила приёма значения обязаны совпадать
   * с `resolve()`, иначе `te()` и `t()` разошлись бы в ответах.
   */
  private hasMessage = (locale: Locale, key: string): boolean => {
    if (this.compiledMessages[locale]?.[key]) return true

    const messages = this.messagesStore[locale]
    if (!messages) return false

    const value = getMessageValue(messages, key)

    if (typeof value === 'string' || typeof value === 'function') return true
    if (isPluralForms(value)) return true

    return value !== undefined && value !== null && typeof value !== 'object'
  }

  public t = (key: MessageKey<Schema>, params?: Record<string, any>, options?: TranslateOptions): string => {
    const locale = this.localeRef.value
    const cleanParams = normalizeTranslateParams(params)

    let resolved = this.resolve(locale, key, cleanParams)

    if (resolved === undefined) {
      const fallbackLocale = options?.fallbackLocale || this.fallbackLocale
      if (fallbackLocale && fallbackLocale !== locale) {
        resolved = this.resolve(fallbackLocale, key, cleanParams)
      }
    }

    const data = this.hooks.emitSync('onTranslate', {
      key,
      params: cleanParams,
      result: resolved,
    })

    if (data.result === undefined) {
      this.reportMissingKey(key, locale)
      return key
    }

    return data.result
  }

  private reportMissingKey = (key: string, locale: Locale) => {
    const dedupeKey = `${locale}:${key}`
    if (this.missingKeyReported.has(dedupeKey)) return
    this.missingKeyReported.add(dedupeKey)

    this.hooks.emit('onMissingKey', { key, locale }).catch((err) => {
      console.error('[fint-i18n] Error in onMissingKey hook:', err)
    })
  }

  private reportError = (error: unknown, context: { block?: string, locale?: Locale } = {}) => {
    if (this.hooks.has('onError')) {
      this.hooks.emit('onError', { error, ...context }).catch((err) => {
        console.error('[fint-i18n] Error in onError hook:', err)
      })
    }
    else {
      console.error('[fint-i18n] Unhandled error:', error, context)
    }
  }

  private resolve = (locale: Locale, key: string, params?: Record<string, any>): string | undefined => {
    const compiled = this.compiledMessages[locale]?.[key]
    if (compiled) {
      return compiled(params)
    }

    const messages = this.messagesStore[locale]
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

    // Набор форм компилируется под правила той локали, из которой пришёл, —
    // сообщение и его грамматика едут вместе.
    if (isPluralForms(current)) {
      const fn = compilePluralForms(current, locale)
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

    let roots = this.compiledKeysByRoot.get(locale)
    if (!roots) {
      roots = new Map()
      this.compiledKeysByRoot.set(locale, roots)
    }

    const root = rootSegment(key)
    let keys = roots.get(root)
    if (!keys) {
      keys = new Set()
      roots.set(root, keys)
    }

    keys.add(key)
  }

  /**
   * Инвалидировать кэш компиляции для поддерева блока: сам блок и все
   * вложенные ключи. Вызывается перед каждым merge, чтобы перезаписанные
   * сообщения не отдавались из устаревшего кэша.
   *
   * Обходится не весь словарь локали, а только ключи одного корневого блока:
   * иначе каждая загрузка блока стоила бы прохода по всем скомпилированным
   * ключам приложения.
   */
  private invalidateCompiled = (locale: Locale, blockName: string) => {
    const compiled = this.compiledMessages[locale]
    if (!compiled) return

    const keys = this.compiledKeysByRoot.get(locale)?.get(rootSegment(blockName))
    if (!keys) return

    const prefix = `${blockName}.`
    for (const key of keys) {
      if (key === blockName || key.startsWith(prefix)) {
        delete compiled[key]
        keys.delete(key)
      }
    }
  }

  /**
   * Развернуть wildcard-паттерн в список конкретных имён блоков.
   * Результат кэшируется по строке паттерна; кэш сбрасывается в addLoaders().
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
    if (this.disposed) return

    const targetLocale = locale || this.localeRef.value

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

    const jobs = [this.loadConcreteBlock(blockName, targetLocale)]
    if (this.preloadFallback && this.fallbackLocale && this.fallbackLocale !== targetLocale) {
      jobs.push(this.loadConcreteBlock(blockName, this.fallbackLocale))
    }
    await Promise.all(jobs)
  }

  /**
   * Вызов лоадера с повторами. Повторяется именно лоадер, а не блок целиком:
   * данные соседних лоадеров того же блока уже смержены и переделывать их
   * незачем.
   *
   * Повторы живут **внутри** промиса блока, поэтому запись в `loadingBlocks`
   * не меняется. Иначе конкурентные `loadBlock` разъехались бы по разным
   * попыткам и дедупликация сломалась бы.
   */
  private runLoader = async (loader: LocaleBlockLoader) => {
    const retry = this.retry
    const attempts = Math.max(1, retry ? retry.attempts ?? DEFAULT_RETRY_ATTEMPTS : 1)
    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt++) {
      // Инстанс освободили между попытками — продолжать нечего.
      if (this.disposed) return undefined

      try {
        return await withTimeout(loader(), retry?.timeout)
      }
      catch (error) {
        lastError = error
        if (attempt === attempts) break
        await wait((retry?.backoff ?? defaultBackoff)(attempt))
      }
    }

    throw lastError
  }

  // Не `async`: промис обязан попасть в `loadingBlocks` до первого `await`,
  // иначе конкурентные вызовы успевают пройти проверку и грузят блок повторно.
  private loadConcreteBlock = (blockName: string, targetLocale: Locale): Promise<void> => {
    const loadKey = `${targetLocale}:${blockName}`

    if (this.isBlockLoaded(blockName, targetLocale)) return Promise.resolve()

    const pending = this.loadingBlocks.get(loadKey)
    if (pending) return pending

    const promise = (async () => {
      try {
        await this.hooks.emit('beforeLoadBlock', blockName)

        const resolvedLoaders = this.loaderRegistry.resolve(targetLocale, blockName)

        if (!resolvedLoaders) {
          console.warn(`[fint-i18n] No loader for block "${blockName}" in locale "${targetLocale}"`)
          return
        }

        let loadedMessages: MessageValue | undefined

        for (const loader of resolvedLoaders.loaders) {
          const module = await this.runLoader(loader)

          // Инстанс освободили, пока лоадер отрабатывал: домерживать некуда,
          // иначе `dispose()` оставлял бы после себя воскресший словарь.
          if (this.disposed) return

          const messages = (
            module && typeof module === 'object' && 'default' in module && module.default
              ? module.default
              : module
          ) as MessageValue

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
    this.invalidateCompiled(locale, blockName)

    if (!this.messagesStore[locale]) {
      this.messagesStore[locale] = reactive({})
    }

    const path = blockName.split('.')
    const rootBlockName = path[0]

    if (path.length === 1) {
      if (isMessageObject(messages)) {
        if (!this.messagesStore[locale][rootBlockName] || typeof this.messagesStore[locale][rootBlockName] !== 'object') {
          this.messagesStore[locale][rootBlockName] = reactive({})
        }
        deepMerge(this.messagesStore[locale][rootBlockName], messages)
      }
      else {
        this.messagesStore[locale][rootBlockName] = messages
      }
    }
    else {
      if (!this.messagesStore[locale][rootBlockName] || typeof this.messagesStore[locale][rootBlockName] !== 'object') {
        this.messagesStore[locale][rootBlockName] = reactive({})
      }

      let target = this.messagesStore[locale][rootBlockName]
      for (let i = 1; i < path.length; i++) {
        const subKey = path[i]
        if (!target[subKey] || typeof target[subKey] !== 'object') {
          target[subKey] = reactive({})
        }
        target = target[subKey]
      }

      deepMerge(target, messages)
    }
  }

  /**
   * Фактически загруженные блоки по локалям — то, что нужно перенести
   * с сервера на клиент, чтобы тот не грузил их заново.
   */
  public getLoadedBlocks = (): Record<Locale, string[]> => {
    const result: Record<Locale, string[]> = {}

    for (const [locale, blocks] of this.loadedBlocks) {
      if (blocks.size > 0) result[locale] = [...blocks]
    }

    return result
  }

  public isBlockLoaded = (blockName: string, locale?: Locale): boolean => {
    const targetLocale = locale || this.localeRef.value
    const loadedSet = this.loadedBlocks.get(targetLocale)
    if (!loadedSet) return false

    if (loadedSet.has(blockName)) return true

    // Блок с собственным лоадером не считается покрытым загруженным предком:
    // сам лоадер ещё не отрабатывал. Без этой проверки лоадер, зарегистрированный
    // через `addLoaders()` после загрузки родителя, не вызвался бы никогда.
    const resolved = this.loaderRegistry.resolve(targetLocale, blockName)
    if (resolved?.resolvedBlockName === blockName) return false

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
    // Появились новые сообщения — ключи могли перестать быть missing.
    this.missingKeyReported.clear()
  }

  public loadUsedBlocks = async (locale: Locale): Promise<void> => {
    // Цикл до сходимости: блоки, зарегистрированные во время текущей
    // загрузки, догружаются следующей итерацией, а не теряются.
    let previousSnapshot = ''

    for (;;) {
      const pendingLoad = this.pendingUsedBlockLoads.get(locale)
      if (pendingLoad) {
        await pendingLoad
        continue
      }

      const blocks: string[] = []
      for (const [blockName, count] of this.blockUsageCounters.entries()) {
        if (count > 0 && !this.isBlockLoaded(blockName, locale)) {
          blocks.push(blockName)
        }
      }
      if (blocks.length === 0) return

      // Защита от вечного цикла: если после загрузки набор не изменился
      // (например, блок стабильно падает и не помечается загруженным) — выходим.
      const snapshot = blocks.join(',')
      if (snapshot === previousSnapshot) return
      previousSnapshot = snapshot

      // Ошибка одного блока не должна отменять загрузку остальных:
      // собираем все результаты и репортим отказы через onError.
      const loadPromise = (async () => {
        const results = await Promise.allSettled(blocks.map(blockName => this.loadBlock(blockName, locale)))
        results.forEach((result, i) => {
          if (result.status === 'rejected') {
            this.reportError(result.reason, { block: blocks[i], locale })
          }
        })
      })()

      this.pendingUsedBlockLoads.set(locale, loadPromise)

      try {
        await loadPromise
      }
      finally {
        this.pendingUsedBlockLoads.delete(locale)
      }
    }
  }

  private hasUnloadedUsedBlocks = (locale: Locale): boolean => {
    if (this.pendingUsedBlockLoads.has(locale)) return true
    for (const [blockName, count] of this.blockUsageCounters.entries()) {
      if (count > 0 && !this.isBlockLoaded(blockName, locale)) return true
    }
    return false
  }

  public setLocale = async (newLocale: Locale): Promise<void> => {
    const previous = this.localeRef.value
    if (previous === newLocale) return

    const epoch = ++this.localeEpoch

    // Догружаем блоки ДО переключения, чтобы не показывать сырые ключи.
    // Если догружать нечего — локаль применяется синхронно (до первого await).
    if (this.hasUnloadedUsedBlocks(newLocale)) {
      await this.loadUsedBlocks(newLocale)
      // Пока грузились блоки, запросили другой переход — этот устарел.
      if (epoch !== this.localeEpoch) return
    }

    this.localeRef.value = newLocale
    this.missingKeyReported.clear()
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
      if (this.unloadUnusedBlocks) {
        this.unloadBlockAllLocales(blockName)
      }
    }
    else {
      this.blockUsageCounters.set(blockName, count - 1)
    }
  }

  /**
   * Выгрузить блок из памяти: удалить поддерево сообщений, инвалидировать
   * кэш компиляции и сбросить отметку о загрузке (следующий `loadBlock`
   * загрузит блок заново).
   *
   * Ограничение: если блок был загружен через родительский лоадер
   * (например, `pages.articles` резолвится в `pages`), выгружать нужно
   * по имени загруженного (родительского) блока.
   */
  public unloadBlock = (blockName: string, locale?: Locale): void => {
    const targetLocale = locale || this.localeRef.value

    const localeMessages = this.messagesStore[targetLocale]
    if (localeMessages) {
      const path = blockName.split('.')
      let target: any = localeMessages
      for (let i = 0; i < path.length - 1 && target; i++) {
        target = typeof target === 'object' ? target[path[i]] : undefined
      }
      if (target && typeof target === 'object') {
        delete target[path[path.length - 1]]
      }
    }

    this.invalidateCompiled(targetLocale, blockName)
    this.loadedBlocks.get(targetLocale)?.delete(blockName)
  }

  private unloadBlockAllLocales = (blockName: string): void => {
    for (const locale of this.loadedBlocks.keys()) {
      this.unloadBlock(blockName, locale)
    }
  }
}

export function createFintI18n<Schema extends MessageSchemaConstraint = any>(options: FintI18nOptions): FintI18n<Schema> {
  return new FintI18n<Schema>(options)
}
