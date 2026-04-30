import { describe, it, expect, expectTypeOf, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { createFintI18n } from '@/core'
import type { Locale, LocaleLoaderCollection, LocaleLoaderSource } from '@/core'

describe('FintI18n', () => {
  it('should translate basic keys', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    
    // Inject some messages manually for test
    ;(i18n as any).mergeMessages('en', 'common', { hello: 'Hello!' })

    expect(i18n.t('common.hello')).toBe('Hello!')
  })

  it('should translate with params', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { greet: 'Hi {name}!' })
    
    expect(i18n.t('common.greet', { name: 'John' })).toBe('Hi John!')
  })

  it('should use fallback locale', async () => {
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { save: 'Save' })
    
    expect(i18n.t('common.save')).toBe('Save')
  })

  it('should load blocks via loaders', async () => {
    const loader = vi.fn().mockResolvedValue({ default: { test: 'Success' } })
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          auth: loader
        }
      }
    })

    await i18n.loadBlock('auth')
    expect(loader).toHaveBeenCalled()
    expect(i18n.t('auth.test')).toBe('Success')
    expect(i18n.isBlockLoaded('auth')).toBe(true)
  })

  it('should load blocks from multiple loader collections', async () => {
    const baseLoader = vi.fn().mockResolvedValue({
      default: {
        title: 'Base title',
        fields: {
          email: 'Email',
        },
      },
    })
    const overrideLoader = vi.fn().mockResolvedValue({
      actions: {
        submit: 'Continue',
      },
      fields: {
        email: 'E-mail',
      },
    })

    const i18n = createFintI18n({
      locale: 'en',
      loaders: [
        {
          en: {
            auth: baseLoader,
          },
        },
        {
          en: {
            auth: overrideLoader,
          },
        },
      ],
    })

    await i18n.loadBlock('auth')

    expect(baseLoader).toHaveBeenCalledTimes(1)
    expect(overrideLoader).toHaveBeenCalledTimes(1)
    expect(i18n.t('auth.title')).toBe('Base title')
    expect(i18n.t('auth.fields.email')).toBe('E-mail')
    expect(i18n.t('auth.actions.submit')).toBe('Continue')
  })

  it('should load blocks from multiple async loaders inside one collection', async () => {
    const firstLoader = vi.fn().mockImplementation(async () => ({
      default: {
        title: 'Auth',
      },
    }))
    const secondLoader = vi.fn().mockImplementation(async () => ({
      actions: {
        submit: 'Sign in',
      },
    }))

    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          auth: [firstLoader, secondLoader],
        },
      },
    })

    await i18n.loadBlock('auth')

    expect(firstLoader).toHaveBeenCalledTimes(1)
    expect(secondLoader).toHaveBeenCalledTimes(1)
    expect(i18n.t('auth.title')).toBe('Auth')
    expect(i18n.t('auth.actions.submit')).toBe('Sign in')
  })

  it('should trigger hooks', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    const onTranslate = vi.fn()
    i18n.hooks.on('onTranslate', onTranslate)
    
    i18n.t('test')
    expect(onTranslate).toHaveBeenCalledWith(expect.objectContaining({ key: 'test' }))
  })

  it('should work when t is destructured', () => {
    const i18n = createFintI18n({ locale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { destruct: 'Success' })

    const { t } = i18n
    expect(t('common.destruct')).toBe('Success')
  })

  it('should work when instance is wrapped in reactive', () => {
    const i18n = reactive(createFintI18n({ locale: 'en' }))
    ;(i18n as any).mergeMessages('en', 'common', { reactive: 'Success' })

    expect(i18n.t('common.reactive')).toBe('Success')
  })

  it('should support numbers in messages', () => {
    const i18n = createFintI18n({ locale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { count: 42 })

    expect(i18n.t('common.count')).toBe('42')
  })

  it('should unref params', () => {
    const i18n = createFintI18n({ locale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { hello: 'Hello {name}!' })

    const name = ref('World')
    expect(i18n.t('common.hello', { name })).toBe('Hello World!')
  })

  it('should not clone plain params objects on the hot path', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const onTranslate = vi.fn(payload => payload)
    const params = { name: 'World' }

    ;(i18n as any).mergeMessages('en', 'common', { hello: 'Hello {name}!' })
    i18n.hooks.on('onTranslate', onTranslate)

    expect(i18n.t('common.hello', params)).toBe('Hello World!')
    expect(onTranslate.mock.calls[0][0].params).toBe(params)
  })

  it('should translate nested message functions from merged schemas', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const greet = vi.fn((params?: Record<string, string>) => `Hi ${params?.name ?? 'Guest'}`)

    i18n.mergeMessages('en', 'common', {
      nested: {
        greet,
      },
    })

    expect(i18n.t('common.nested.greet', { name: 'John' })).toBe('Hi John')
    expect(greet).toHaveBeenCalledWith({ name: 'John' })
  })

  it('should handle deep merging correctly', () => {
    const i18n = createFintI18n({ locale: 'en' })
    ;(i18n as any).mergeMessages('en', 'common', { a: { b: 1 } })
    ;(i18n as any).mergeMessages('en', 'common', { a: { c: 2 } })
    
    expect(i18n.t('common.a.b')).toBe('1')
    expect(i18n.t('common.a.c')).toBe('2')
  })

  it('should track block usage and load on demand', async () => {
    const loader = vi.fn().mockResolvedValue({ test: 'ok' })
    const i18n = createFintI18n({ 
      locale: 'en',
      loaders: { en: { auth: loader } }
    })
    
    await i18n.loadBlock('auth')
    expect(i18n.isBlockLoaded('auth')).toBe(true)
    
    i18n.registerUsage('auth')
    i18n.registerUsage('auth')
    i18n.unregisterUsage('auth')
    
    expect(i18n.isBlockLoaded('auth')).toBe(true)
  })
  it('should use override fallback locale', () => {
    const i18n = createFintI18n({ locale: 'en', fallbackLocale: 'ru' })
    i18n.mergeMessages('es', 'common', { welcome: 'Hola' })
    
    expect(i18n.t('common.welcome', {}, { fallbackLocale: 'es' })).toBe('Hola')
  })

  it('should expose locale-related APIs through Locale type', async () => {
    const i18n = createFintI18n({ locale: 'en' })

    expectTypeOf<Locale>().toEqualTypeOf<string>()
    expectTypeOf(i18n.locale.value).toEqualTypeOf<Locale>()
    expectTypeOf(i18n.fallbackLocale).toEqualTypeOf<Locale>()
    expectTypeOf(i18n.loadBlock).parameter(1).toEqualTypeOf<Locale | undefined>()
    expectTypeOf(i18n.isBlockLoaded).parameter(1).toEqualTypeOf<Locale | undefined>()
    expectTypeOf(i18n.setLocale).parameter(0).toEqualTypeOf<Locale>()

    await expect(i18n.setLocale('ru')).resolves.toBeUndefined()
  })

  it('should accept both object and array loader sources in options typing', () => {
    const collection = {
      en: {
        auth: async () => ({ default: { title: 'Auth' } }),
      },
    } satisfies LocaleLoaderCollection
    const source = [collection] satisfies LocaleLoaderSource

    expectTypeOf(collection).toMatchTypeOf<LocaleLoaderCollection>()
    expectTypeOf(source).toMatchTypeOf<LocaleLoaderSource>()
  })

  it('should return key if missing and no fallback', () => {
    const i18n = createFintI18n({ locale: 'en' })
    expect(i18n.t('missing')).toBe('missing')
  })

  it('should handle block merging with non-object values', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'raw', 'simple string' as any)
    expect(i18n.t('raw')).toBe('simple string')
  })

  it('should handle nested block merging', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'a.b.c', { d: 'deep' })
    expect(i18n.t('a.b.c.d')).toBe('deep')
  })

  it('should handle registration of multiple blocks', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.registerBlocks(['a', 'b'])
    // @ts-expect-error: accessing private property for testing
    expect(i18n.blockUsageCounters.get('a')).toBe(1)
    // @ts-expect-error: accessing private property for testing
    expect(i18n.blockUsageCounters.get('b')).toBe(1)
  })

  it('should check parent blocks in isBlockLoaded', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.markBlockLoaded('pages', 'en')
    expect(i18n.isBlockLoaded('pages.home', 'en')).toBe(true)
  })

  it('should return undefined from resolve for unknown values', () => {
    const i18n = createFintI18n({ locale: 'en' })
    // @ts-expect-error: testing invalid input
    expect(i18n.resolve('en', 'unknown')).toBeUndefined()
  })

  describe('wildcard block registration', () => {
    it('registerBlocks expands "prefix.*" into direct child usage counters', () => {
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': vi.fn().mockResolvedValue({}),
            'components.second': vi.fn().mockResolvedValue({}),
            'components.deep.x': vi.fn().mockResolvedValue({}),
            'page.articles': vi.fn().mockResolvedValue({}),
          },
        },
      })

      i18n.registerBlocks(['components.*'])

      // @ts-expect-error: accessing private property for testing
      const counters = i18n.blockUsageCounters
      expect(counters.get('components.first')).toBe(1)
      expect(counters.get('components.second')).toBe(1)
      expect(counters.get('components.deep.x')).toBeUndefined()
      expect(counters.get('components.*')).toBeUndefined()
      expect(counters.get('page.articles')).toBeUndefined()
    })

    it('registerBlocks expands "prefix.**" recursively', () => {
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': vi.fn().mockResolvedValue({}),
            'components.deep.x': vi.fn().mockResolvedValue({}),
            'components.deep.y.z': vi.fn().mockResolvedValue({}),
          },
        },
      })

      i18n.registerBlocks(['components.**'])

      // @ts-expect-error: accessing private property for testing
      const counters = i18n.blockUsageCounters
      expect(counters.get('components.first')).toBe(1)
      expect(counters.get('components.deep.x')).toBe(1)
      expect(counters.get('components.deep.y.z')).toBe(1)
    })

    it('loadUsedBlocks loads all child blocks expanded from a wildcard', async () => {
      const first = vi.fn().mockResolvedValue({ title: 'First' })
      const second = vi.fn().mockResolvedValue({ title: 'Second' })
      const articles = vi.fn().mockResolvedValue({ list: 'List' })
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': first,
            'components.second': second,
            'page.articles': articles,
          },
        },
      })

      i18n.registerBlocks(['components.*'])
      await i18n.loadUsedBlocks('en')

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(articles).not.toHaveBeenCalled()
      expect(i18n.t('components.first.title')).toBe('First')
      expect(i18n.t('components.second.title')).toBe('Second')
    })

    it('loadBlock("prefix.*") loads child blocks directly without registering', async () => {
      const first = vi.fn().mockResolvedValue({ x: '1' })
      const second = vi.fn().mockResolvedValue({ x: '2' })
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': first,
            'components.second': second,
          },
        },
      })

      await i18n.loadBlock('components.*')

      expect(first).toHaveBeenCalledTimes(1)
      expect(second).toHaveBeenCalledTimes(1)
      expect(i18n.isBlockLoaded('components.first')).toBe(true)
      expect(i18n.isBlockLoaded('components.second')).toBe(true)
    })

    it('unregisterUsage with the same pattern decrements the same children', () => {
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': vi.fn().mockResolvedValue({}),
            'components.second': vi.fn().mockResolvedValue({}),
          },
        },
      })

      i18n.registerUsage('components.*')
      i18n.registerUsage('components.*')
      i18n.unregisterUsage('components.*')

      // @ts-expect-error: accessing private property for testing
      const counters = i18n.blockUsageCounters
      expect(counters.get('components.first')).toBe(1)
      expect(counters.get('components.second')).toBe(1)

      i18n.unregisterUsage('components.*')
      expect(counters.get('components.first')).toBeUndefined()
      expect(counters.get('components.second')).toBeUndefined()
    })

    it('combines multiple "all"-loader collections from different packages (Variant 3)', async () => {
      // Имитируем три "пакета", каждый из которых публикует свой
      // `<pkg>/i18n/all` — массив `LocaleLoaderCollection[]` с per-locale записями
      // (ровно так выглядит реальный расклад файлов вида en.ts/ru.ts/...,
      // объединённых в `all.ts`). Локали у пакетов умышленно разные.
      const corePkg: LocaleLoaderCollection[] = [
        { ru: { core: vi.fn().mockResolvedValue({ default: { title: 'Ядро' } }) } },
        { en: { core: vi.fn().mockResolvedValue({ default: { title: 'Core' } }) } },
        { es: { core: vi.fn().mockResolvedValue({ default: { title: 'Núcleo' } }) } },
        // Общий блок `common` из ядра — должен мержиться с одноимённым из аналитики (см. ниже).
        { en: { common: vi.fn().mockResolvedValue({ default: { brand: 'Acme', tagline: 'core-tagline' } }) } },
      ]
      const billingPkg: LocaleLoaderCollection[] = [
        { ru: { billing: vi.fn().mockResolvedValue({ default: { invoice: 'Счёт' } }) } },
        { en: { billing: vi.fn().mockResolvedValue({ default: { invoice: 'Invoice' } }) } },
      ]
      const analyticsPkg: LocaleLoaderCollection[] = [
        { en: { analytics: vi.fn().mockResolvedValue({ default: { event: 'Event' } }) } },
        { gr: { analytics: vi.fn().mockResolvedValue({ default: { event: 'Συμβάν' } }) } },
        // Расширяем `common` для `en`: пересекающийся ключ `tagline` должен
        // перетереть значение из ядра — приоритет у поздних коллекций.
        { en: { common: vi.fn().mockResolvedValue({ tagline: 'analytics-tagline' }) } },
      ]

      const loaders: LocaleLoaderSource = [
        ...corePkg,
        ...billingPkg,
        ...analyticsPkg,
      ]

      const i18n = createFintI18n({
        locale: 'en',
        fallbackLocale: 'en',
        loaders,
      })

      // EN: видны блоки из всех трёх пакетов.
      await i18n.loadBlock('core')
      await i18n.loadBlock('billing')
      await i18n.loadBlock('analytics')
      await i18n.loadBlock('common')

      expect(i18n.t('core.title')).toBe('Core')
      expect(i18n.t('billing.invoice')).toBe('Invoice')
      expect(i18n.t('analytics.event')).toBe('Event')
      // Слияние блоков `common` из core+analytics, причём поздняя коллекция перекрывает.
      expect(i18n.t('common.brand')).toBe('Acme')
      expect(i18n.t('common.tagline')).toBe('analytics-tagline')

      // RU: только core + billing (analytics в `ru` не публикует).
      await i18n.setLocale('ru')
      await i18n.loadBlock('core')
      await i18n.loadBlock('billing')
      expect(i18n.t('core.title')).toBe('Ядро')
      expect(i18n.t('billing.invoice')).toBe('Счёт')
      // Нет аналитики в ru — ключ не существует ни в активной, ни в fallback-локали (en есть).
      // Здесь сознательно проверяем fallback на `en` для `analytics`.
      await i18n.loadBlock('analytics')
      expect(i18n.t('analytics.event')).toBe('Event')

      // ES: только core (billing/analytics не публикуют es) — fallback на en.
      await i18n.setLocale('es')
      await i18n.loadBlock('core')
      expect(i18n.t('core.title')).toBe('Núcleo')
      await i18n.loadBlock('billing')
      expect(i18n.t('billing.invoice')).toBe('Invoice')

      // GR: только analytics (core/billing не публикуют gr) — fallback на en.
      await i18n.setLocale('gr')
      await i18n.loadBlock('analytics')
      expect(i18n.t('analytics.event')).toBe('Συμβάν')
      await i18n.loadBlock('core')
      expect(i18n.t('core.title')).toBe('Core')
      await i18n.loadBlock('billing')
      expect(i18n.t('billing.invoice')).toBe('Invoice')
    })

    it('warns and skips load when pattern matches nothing', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const i18n = createFintI18n({
        locale: 'en',
        loaders: {
          en: {
            'components.first': vi.fn().mockResolvedValue({}),
          },
        },
      })

      i18n.registerBlocks(['unknown.*'])
      await i18n.loadUsedBlocks('en')

      expect(warn).toHaveBeenCalled()
      expect(warn.mock.calls[0][0]).toContain('did not match any registered block')

      // @ts-expect-error: accessing private property for testing
      const counters = i18n.blockUsageCounters
      expect(counters.size).toBe(0)
      warn.mockRestore()
    })
  })
})
