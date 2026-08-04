import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'
import type { FintI18nPlugin } from '../types'

describe('dispose', () => {
  it('releases messages, so t() falls back to keys', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({ k: 'value' }) } },
    })

    await i18n.loadBlock('a')
    expect(i18n.t('a.k')).toBe('value')

    i18n.dispose()

    expect(i18n.t('a.k')).toBe('a.k')
    expect(Object.keys(i18n.messages)).toEqual([])
    expect(i18n.isBlockLoaded('a')).toBe(false)
  })

  it('drops hook subscriptions that plugins did not register', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const onTranslate = vi.fn(data => data)

    i18n.hooks.on('onTranslate', onTranslate)
    i18n.t('x')
    expect(onTranslate).toHaveBeenCalledTimes(1)

    i18n.dispose()
    i18n.t('x')

    expect(onTranslate).toHaveBeenCalledTimes(1)
    expect(i18n.hooks.has('onTranslate')).toBe(false)
  })

  it('uninstalls plugins before clearing subscriptions', () => {
    const order: string[] = []
    const plugin: FintI18nPlugin = {
      name: 'probe',
      install: (instance) => {
        instance.hooks.on('onLocaleChange', () => { order.push('hook') })
      },
      uninstall: () => order.push('uninstall'),
    }

    const i18n = createFintI18n({ locale: 'en', plugins: [plugin] })
    i18n.dispose()

    expect(order).toEqual(['uninstall'])
  })

  it('resets usage counters and the wildcard expansion cache', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      unloadUnusedBlocks: true,
      loaders: { en: { 'w.a': async () => ({ k: 'v' }) } },
    })

    i18n.registerUsage('w.*')
    await i18n.loadBlock('w.*')
    expect(i18n.t('w.a.k')).toBe('v')

    i18n.dispose()

    expect(i18n.t('w.a.k')).toBe('w.a.k')
  })

  it('discards a load that was in flight when dispose was called', async () => {
    let release: (value: { k: string }) => void = () => {}
    const pending = new Promise<{ k: string }>((resolve) => { release = resolve })

    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: () => pending } },
    })

    const load = i18n.loadBlock('a')
    i18n.dispose()
    release({ k: 'late value' })
    await load

    expect(i18n.t('a.k')).toBe('a.k')
    expect(Object.keys(i18n.messages)).toEqual([])
  })

  it('ignores loadBlock called after dispose', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    i18n.dispose()
    await i18n.loadBlock('a')

    expect(loader).not.toHaveBeenCalled()
  })

  it('is idempotent', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({ k: 'v' }) } },
    })

    await i18n.loadBlock('a')
    i18n.dispose()

    expect(() => i18n.dispose()).not.toThrow()
    expect(i18n.t('a.k')).toBe('a.k')
  })

  it('keeps the locale readable after dispose', () => {
    const i18n = createFintI18n({ locale: 'en' })

    i18n.dispose()

    expect(i18n.locale.value).toBe('en')
  })
})
