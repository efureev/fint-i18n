import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../instance'

function instance() {
  const i18n = createFintI18n({ locale: 'en', fallbackLocale: 'ru' })

  i18n.mergeMessages('en', 'common', {
    welcome: 'Welcome, {name}!',
    // Сообщение, значение которого совпадает с его собственным ключом —
    // ровно тот случай, на котором врёт проверка `t(k) !== k`.
    selfNamed: 'common.selfNamed',
    zero: 0,
    flag: false,
    fn: ((p: any) => `fn:${p?.n}`) as any,
    items: { one: '{n} item', other: '{n} items' },
    menu: { home: 'Home', settings: 'Settings', nested: { deep: 'Deep' } },
  })
  i18n.mergeMessages('ru', 'common', { onlyRu: 'только по-русски' })

  return i18n
}

describe('te', () => {
  it('is true for an existing message', () => {
    expect(instance().te('common.welcome')).toBe(true)
  })

  it('is false for a missing key', () => {
    expect(instance().te('common.nope')).toBe(false)
  })

  it('is true for a message whose value equals its own key', () => {
    const i18n = instance()

    // Именно здесь сравнение с ключом дало бы неверный ответ.
    expect(i18n.t('common.selfNamed')).toBe('common.selfNamed')
    expect(i18n.te('common.selfNamed')).toBe(true)
  })

  it('accepts non-string primitives, exactly as t() does', () => {
    const i18n = instance()

    expect(i18n.te('common.zero')).toBe(true)
    expect(i18n.te('common.flag')).toBe(true)
    expect(i18n.t('common.zero')).toBe('0')
  })

  it('accepts message functions and plural form sets', () => {
    const i18n = instance()

    expect(i18n.te('common.fn')).toBe(true)
    expect(i18n.te('common.items')).toBe(true)
  })

  it('is false for a namespace', () => {
    expect(instance().te('common.menu')).toBe(false)
  })

  it('follows the fallback locale like t() does', () => {
    const i18n = instance()

    expect(i18n.te('common.onlyRu')).toBe(true)
    expect(i18n.t('common.onlyRu')).toBe('только по-русски')
  })

  it('checks only the requested locale when one is given', () => {
    const i18n = instance()

    expect(i18n.te('common.onlyRu', 'en')).toBe(false)
    expect(i18n.te('common.onlyRu', 'ru')).toBe(true)
    expect(i18n.te('common.welcome', 'ru')).toBe(false)
  })

  it('agrees with t() on every key of the dictionary', () => {
    const i18n = instance()

    for (const key of ['common.welcome', 'common.selfNamed', 'common.zero', 'common.onlyRu', 'common.nope']) {
      const resolved = i18n.t(key) !== key || i18n.te(key)
      expect(resolved).toBe(i18n.te(key) || i18n.t(key) !== key)
    }

    // Ключ отсутствует — оба согласны.
    expect(i18n.te('common.nope')).toBe(false)
    expect(i18n.t('common.nope')).toBe('common.nope')
  })

  it('sees a block that was loaded lazily', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { late: async () => ({ k: 'v' }) } },
    })

    expect(i18n.te('late.k')).toBe(false)
    await i18n.loadBlock('late')
    expect(i18n.te('late.k')).toBe(true)
  })
})

describe('tm', () => {
  it('returns a namespace subtree', () => {
    expect(instance().tm('common.menu')).toEqual({
      home: 'Home',
      settings: 'Settings',
      nested: { deep: 'Deep' },
    })
  })

  it('returns undefined for a leaf', () => {
    expect(instance().tm('common.welcome')).toBeUndefined()
  })

  it('returns undefined for a set of plural forms', () => {
    // Формы — это сообщение, а не пространство имён; читаются через t().
    expect(instance().tm('common.items')).toBeUndefined()
  })

  it('returns undefined for a missing key', () => {
    expect(instance().tm('common.nope')).toBeUndefined()
  })

  it('hands back a readonly view', () => {
    const menu = instance().tm('common.menu') as Record<string, string>

    expect(() => { menu.home = 'mutated' }).not.toThrow()
    expect(menu.home).toBe('Home')
  })

  it('does not let a mutation reach the store', () => {
    const i18n = instance()
    const menu = i18n.tm('common.menu') as Record<string, string>

    menu.home = 'mutated'

    expect(i18n.t('common.menu.home')).toBe('Home')
  })

  it('follows the fallback locale', () => {
    const i18n = createFintI18n({ locale: 'en', fallbackLocale: 'ru' })
    i18n.mergeMessages('ru', 'common', { menu: { a: 'А' } })

    expect(i18n.tm('common.menu')).toEqual({ a: 'А' })
  })

  it('reads only the requested locale when one is given', () => {
    const i18n = createFintI18n({ locale: 'en', fallbackLocale: 'ru' })
    i18n.mergeMessages('ru', 'common', { menu: { a: 'А' } })

    expect(i18n.tm('common.menu', 'en')).toBeUndefined()
    expect(i18n.tm('common.menu', 'ru')).toEqual({ a: 'А' })
  })

  it('gives the whole block for a block-level key', () => {
    expect(Object.keys(instance().tm('common') ?? {})).toContain('menu')
  })
})

describe('getAvailableLocales', () => {
  it('lists locales declared by loaders', () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({}) }, ru: { a: async () => ({}) } },
    })

    expect(i18n.getAvailableLocales().sort()).toEqual(['en', 'ru'])
  })

  it('lists locales that only have merged messages', () => {
    const i18n = createFintI18n({ locale: 'en' })

    expect(i18n.getAvailableLocales()).toEqual([])

    i18n.mergeMessages('de', 'a', { k: 'v' })

    expect(i18n.getAvailableLocales()).toEqual(['de'])
    // `getKnownLocales()` отвечает на другой вопрос — только про лоадеры.
    expect(i18n.getKnownLocales()).toEqual([])
  })

  it('unions both sources without duplicates', () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { a: async () => ({}) } },
    })
    i18n.mergeMessages('en', 'b', { k: 'v' })
    i18n.mergeMessages('fr', 'b', { k: 'v' })

    expect(i18n.getAvailableLocales().sort()).toEqual(['en', 'fr'])
  })

  it('picks up locales added by addLoaders', () => {
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: async () => ({}) } } })

    i18n.addLoaders({ ru: { a: async () => ({}) } })

    expect(i18n.getAvailableLocales().sort()).toEqual(['en', 'ru'])
  })
})
