import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

describe('parallel loadBlock deduplication', () => {
  it('calls the loader once for two concurrent loads of one block', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    await Promise.all([i18n.loadBlock('a'), i18n.loadBlock('a')])

    expect(loader).toHaveBeenCalledTimes(1)
    expect(i18n.t('a.k')).toBe('v')
  })

  it('calls the loader once however many concurrent loads there are', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    await Promise.all(Array.from({ length: 8 }, () => i18n.loadBlock('a')))

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('deduplicates even when a beforeLoadBlock subscriber is async', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })
    i18n.hooks.on('beforeLoadBlock', async () => { await Promise.resolve() })

    await Promise.all([i18n.loadBlock('a'), i18n.loadBlock('a'), i18n.loadBlock('a')])

    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('still emits beforeLoadBlock exactly once per deduplicated load', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const before = vi.fn()
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })
    i18n.hooks.on('beforeLoadBlock', before)

    await Promise.all([i18n.loadBlock('a'), i18n.loadBlock('a')])

    expect(before).toHaveBeenCalledTimes(1)
  })

  it('does not deduplicate across locales', async () => {
    const en = vi.fn(async () => ({ k: 'v' }))
    const ru = vi.fn(async () => ({ k: 'з' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: en }, ru: { a: ru } } })

    await Promise.all([i18n.loadBlock('a', 'en'), i18n.loadBlock('a', 'ru')])

    expect(en).toHaveBeenCalledTimes(1)
    expect(ru).toHaveBeenCalledTimes(1)
  })

  it('reloads after the block has been unloaded', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    await i18n.loadBlock('a')
    i18n.unloadBlock('a')
    await i18n.loadBlock('a')

    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('releases the in-flight entry when the loader rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    let attempt = 0
    const loader = vi.fn(async () => {
      attempt++
      if (attempt === 1) throw new Error('boom')
      return { k: 'v' }
    })
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom')
    await i18n.loadBlock('a')

    expect(i18n.t('a.k')).toBe('v')
    error.mockRestore()
  })
})
