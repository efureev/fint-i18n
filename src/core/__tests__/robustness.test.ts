import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { HookManager } from '../hooks'
import { createFintI18n } from '../instance'
import { LocaleLoaderRegistry } from '../loader-registry'
import { compilePluralForms } from '../plural'
import { normalizeTranslateParams } from '../translate-params'

describe('HookManager.off: nothing to remove', () => {
  it('ignores off for a hook nobody subscribed to', () => {
    const hooks = new HookManager()

    expect(() => hooks.off('onTranslate', vi.fn())).not.toThrow()
    expect(hooks.has('onTranslate')).toBe(false)
  })

  it('ignores off for a function that was never registered', () => {
    const hooks = new HookManager()
    const registered = vi.fn()
    hooks.on('afterInit', registered)

    hooks.off('afterInit', vi.fn())

    expect(hooks.has('afterInit')).toBe(true)
  })

  it('drops the hook entry once its last subscriber leaves', () => {
    const hooks = new HookManager()
    const fn = vi.fn()
    hooks.on('afterInit', fn)

    hooks.off('afterInit', fn)

    expect(hooks.has('afterInit')).toBe(false)
  })

  it('is idempotent', () => {
    const hooks = new HookManager()
    const fn = vi.fn()
    const off = hooks.on('afterInit', fn)

    off()
    expect(() => off()).not.toThrow()
    expect(hooks.has('afterInit')).toBe(false)
  })
})

describe('normalizeTranslateParams: several refs', () => {
  // Копия создаётся один раз, при первом ref, — второй должен попасть в неё же.
  it('unwraps every ref, not just the first', () => {
    const params = { a: ref('1'), b: ref('2'), c: 'plain' }

    expect(normalizeTranslateParams(params)).toEqual({ a: '1', b: '2', c: 'plain' })
  })
})

describe('compilePluralForms without a locale', () => {
  it('uses english rules', () => {
    const fn = compilePluralForms({ one: '{n} file', other: '{n} files' })

    expect(fn({ n: 1 })).toBe('1 file')
    expect(fn({ n: 5 })).toBe('5 files')
  })

  it('names the default locale when warning about a missing `other`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const fn = compilePluralForms({ one: '{n} file' })

    expect(warn.mock.calls[0][0]).toContain('"en"')
    expect(fn({ n: 5 })).toBe('5 file')

    warn.mockRestore()
  })
})

describe('LocaleLoaderRegistry.getKnownBlockNames', () => {
  it('unions block names across locales without duplicates', () => {
    const noop = async () => ({})
    const registry = new LocaleLoaderRegistry({
      en: { common: noop, auth: noop },
      ru: { common: noop, cart: noop },
    })

    expect([...registry.getKnownBlockNames()].sort()).toEqual(['auth', 'cart', 'common'])
  })

  it('grows when loaders are added at runtime', () => {
    const noop = async () => ({})
    const registry = new LocaleLoaderRegistry({ en: { common: noop } })

    registry.add({ en: { extra: noop } })

    expect([...registry.getKnownBlockNames()].sort()).toEqual(['common', 'extra'])
  })

  it('is empty without any source', () => {
    expect(new LocaleLoaderRegistry().getKnownBlockNames()).toEqual([])
  })
})

describe('loadBlock: wildcard that matches nothing', () => {
  it('warns and loads nothing instead of throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const loader = vi.fn(async () => ({ title: 'Title' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { common: loader } } })

    await expect(i18n.loadBlock('nothing.*')).resolves.toBeUndefined()

    expect(loader).not.toHaveBeenCalled()
    expect(warn.mock.calls[0][0]).toContain('did not match any registered block')

    warn.mockRestore()
  })

  it('mentions the locale it was looking in', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = createFintI18n({ locale: 'en' })

    await i18n.loadBlock('nothing.**', 'de')

    expect(warn.mock.calls[0][0]).toContain('"de"')

    warn.mockRestore()
  })
})

describe('loadUsedBlocks: concurrent calls', () => {
  it('shares one in-flight load rather than starting a second', async () => {
    const loader = vi.fn(async () => ({ title: 'Title' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { common: loader } } })
    i18n.registerUsage('common')

    await Promise.all([i18n.loadUsedBlocks('en'), i18n.loadUsedBlocks('en')])

    expect(loader).toHaveBeenCalledTimes(1)
    expect(i18n.t('common.title')).toBe('Title')
  })

  it('returns immediately when nothing is in use', async () => {
    const loader = vi.fn(async () => ({ title: 'Title' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { common: loader } } })

    await i18n.loadUsedBlocks('en')

    expect(loader).not.toHaveBeenCalled()
  })

  // Блок, который стабильно падает, не должен зациклить догрузку.
  it('gives up instead of looping on a block that keeps failing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loader = vi.fn(async () => { throw new Error('nope') })
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { bad: loader } } })
    i18n.registerUsage('bad')

    await i18n.loadUsedBlocks('en')

    expect(loader).toHaveBeenCalledTimes(1)

    error.mockRestore()
  })
})
