import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import { PersistencePlugin } from '../persistence'

function makeStorage(value: string | null) {
  return {
    getItem: vi.fn().mockReturnValue(value),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  } as unknown as Storage
}

describe('PersistencePlugin: stored locale validation', () => {
  it('accepts a locale known from loaders', () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({}) }, ru: { a: async () => ({}) } },
      plugins: [new PersistencePlugin({ storage: makeStorage('ru'), syncTabs: false })],
    })

    expect(i18n.locale.value).toBe('ru')
  })

  it('rejects a locale that no loader declares', () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({}) } },
      plugins: [new PersistencePlugin({ storage: makeStorage('totally-unknown'), syncTabs: false })],
    })

    expect(i18n.locale.value).toBe('en')
  })

  it('ignores a stored locale when nothing is known about locales', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage: makeStorage('totally-unknown'), syncTabs: false })],
    })

    expect(i18n.locale.value).toBe('en')
    expect(warn.mock.calls[0][0]).toContain('cannot tell which locales exist')

    warn.mockRestore()
  })

  it('warns about unknown locales only once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const storage = makeStorage('x')
    const plugin = new PersistencePlugin({ storage, syncTabs: false })

    const i18n = createFintI18n({ locale: 'en', plugins: [plugin] })
    plugin.install(i18n)

    expect(warn).toHaveBeenCalledOnce()

    warn.mockRestore()
  })

  it('accepts a locale from an explicit allowlist even without loaders', () => {
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new PersistencePlugin({ storage: makeStorage('ru'), syncTabs: false, allowedLocales: ['en', 'ru'] })],
    })

    expect(i18n.locale.value).toBe('ru')
  })

  it('lets the allowlist override what loaders declare', () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({}) }, ru: { a: async () => ({}) } },
      plugins: [new PersistencePlugin({ storage: makeStorage('ru'), syncTabs: false, allowedLocales: ['en'] })],
    })

    expect(i18n.locale.value).toBe('en')
  })

  it('falls back to locales present in already merged messages', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('ru', 'a', { k: 'ру' })

    const plugin = new PersistencePlugin({ storage: makeStorage('ru'), syncTabs: false })
    plugin.install(i18n)

    expect(i18n.locale.value).toBe('ru')
  })
})
