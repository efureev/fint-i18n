import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileTemplate } from '../compiler'
import { createFintI18n } from '../instance'
import {
  clearPluralCache,
  compilePluralForms,
  getPluralCategories,
  isPluralForms,
  selectPluralCategory,
} from '../plural'

describe('plural rules', () => {
  beforeEach(() => {
    clearPluralCache()
  })

  it('returns CLDR categories in canonical order', () => {
    expect(getPluralCategories('en')).toEqual(['one', 'other'])
    expect(getPluralCategories('ru')).toEqual(['one', 'few', 'many', 'other'])
    expect(getPluralCategories('ar')).toEqual(['zero', 'one', 'two', 'few', 'many', 'other'])
    expect(getPluralCategories('ja')).toEqual(['other'])
  })

  it('selects categories for russian', () => {
    expect(selectPluralCategory('ru', 1)).toBe('one')
    expect(selectPluralCategory('ru', 3)).toBe('few')
    expect(selectPluralCategory('ru', 7)).toBe('many')
    expect(selectPluralCategory('ru', 21)).toBe('one')
  })

  it('falls back to english rules for an invalid locale tag, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(selectPluralCategory('not a locale', 1)).toBe('one')
    expect(selectPluralCategory('not a locale', 5)).toBe('other')
    expect(warn).toHaveBeenCalledOnce()

    warn.mockRestore()
  })
})

describe('isPluralForms', () => {
  it('recognises an object whose keys are all form keys', () => {
    expect(isPluralForms({ one: 'a', other: 'b' })).toBe(true)
    expect(isPluralForms({ '=0': 'none', 'one': 'a', 'other': 'b' })).toBe(true)
    expect(isPluralForms({ zero: 'a', two: 'b', few: 'c', many: 'd', other: 'e' })).toBe(true)
  })

  it('rejects ordinary namespaces and non-objects', () => {
    expect(isPluralForms({ save: 'a', cancel: 'b' })).toBe(false)
    expect(isPluralForms({ one: 'a', title: 'b' })).toBe(false)
    expect(isPluralForms({})).toBe(false)
    expect(isPluralForms('one')).toBe(false)
    expect(isPluralForms(null)).toBe(false)
    expect(isPluralForms(['one', 'other'])).toBe(false)
    expect(isPluralForms({ '=x': 'a' })).toBe(false)
  })
})

describe('compilePluralForms', () => {
  beforeEach(() => {
    clearPluralCache()
  })

  it('picks a russian form by category', () => {
    const fn = compilePluralForms(
      { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' },
      'ru',
    )

    expect(fn({ n: 1 })).toBe('1 файл')
    expect(fn({ n: 3 })).toBe('3 файла')
    expect(fn({ n: 7 })).toBe('7 файлов')
    expect(fn({ n: 21 })).toBe('21 файл')
    expect(fn({ n: 1.5 })).toBe('1.5 файла')
  })

  it('accepts `count` as well as `n`, with `count` winning', () => {
    const fn = compilePluralForms({ one: 'one-form', other: 'other-form' }, 'en')

    expect(fn({ count: 1 })).toBe('one-form')
    expect(fn({ n: 1 })).toBe('one-form')
    expect(fn({ count: 1, n: 5 })).toBe('one-form')
    expect(fn({ count: undefined, n: 5 })).toBe('other-form')
  })

  it('honours exact-value forms before categories', () => {
    const fn = compilePluralForms(
      { '=0': 'нет файлов', 'one': '{n} файл', 'few': '{n} файла', 'many': '{n} файлов', 'other': '{n} файла' },
      'ru',
    )

    expect(fn({ n: 0 })).toBe('нет файлов')
    expect(fn({ n: 1 })).toBe('1 файл')
    expect(fn({ n: 5 })).toBe('5 файлов')
  })

  it('supports negative and fractional exact forms', () => {
    const fn = compilePluralForms({ '=-1': 'минус один', '=1.5': 'полтора', 'other': '{n}' }, 'en')

    expect(fn({ n: -1 })).toBe('минус один')
    expect(fn({ n: 1.5 })).toBe('полтора')
    expect(fn({ n: 4 })).toBe('4')
  })

  it('falls back to `other` when the locale category has no form', () => {
    const fn = compilePluralForms({ one: '{n} файл', other: '{n} файлов' }, 'ru')

    expect(fn({ n: 3 })).toBe('3 файлов')
  })

  it('uses `other` when no count is supplied', () => {
    const fn = compilePluralForms({ one: '{n} file', other: '{n} files' }, 'en')

    expect(fn()).toBe('{n} files')
    expect(fn({ user: 'x' })).toBe('{n} files')
  })

  it('warns about a missing `other` form instead of throwing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fn = compilePluralForms({ one: 'один' }, 'ru')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('without an "other" branch'))
    expect(fn({ n: 5 })).toBe('один')

    warn.mockRestore()
  })

  it('coerces string and bigint counts', () => {
    const fn = compilePluralForms({ one: 'one-form', other: 'other-form' }, 'en')

    expect(fn({ n: '1' })).toBe('one-form')
    expect(fn({ n: '3' })).toBe('other-form')
    expect(fn({ n: 1n })).toBe('one-form')
    expect(fn({ n: 3n })).toBe('other-form')
  })

  it('ignores a count that is not a number', () => {
    const fn = compilePluralForms({ one: 'one-form', other: 'other-form' }, 'en')

    expect(fn({ n: 'many' })).toBe('other-form')
    expect(fn({ n: null })).toBe('other-form')
    expect(fn({ n: true })).toBe('other-form')
  })

  it('returns a stable result across repeated counts (memoised path)', () => {
    const fn = compilePluralForms({ one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' }, 'ru')

    for (let round = 0; round < 3; round++) {
      expect(fn({ n: 1 })).toBe('1 файл')
      expect(fn({ n: 3 })).toBe('3 файла')
      expect(fn({ n: 100 })).toBe('100 файлов')
      expect(fn({ n: 1000 })).toBe('1000 файлов')
    }
  })
})

describe('messages containing a pipe are ordinary text', () => {
  const cases = [
    'Name | Email',
    'Home | Settings | Profile',
    'Page {n} of {total} | {total} results',
    'Ctrl || Shift',
    '|leading',
    'trailing|',
    'one:x | other:y',
  ]

  for (const template of cases) {
    it(`renders ${JSON.stringify(template)} verbatim whatever the params`, () => {
      const fn = compileTemplate(template)
      const interpolated = template.replace(/\{n\}/g, '3').replace(/\{total\}/g, '40')

      expect(fn()).toBe(template)
      expect(fn({ n: 3, total: 40 })).toBe(interpolated)
      expect(fn({ count: 12 })).toBe(template)
    })
  }
})

describe('plural through t()', () => {
  it('resolves forms per locale', async () => {
    const i18n = createFintI18n({
      locale: 'ru',
      loaders: {
        ru: { cart: async () => ({ items: { one: '{count} товар', few: '{count} товара', many: '{count} товаров', other: '{count} товара' } }) },
        en: { cart: async () => ({ items: { one: '{count} item', other: '{count} items' } }) },
      },
    })

    await i18n.loadBlock('cart', 'ru')
    await i18n.loadBlock('cart', 'en')

    expect(i18n.t('cart.items', { count: 1 })).toBe('1 товар')
    expect(i18n.t('cart.items', { count: 3 })).toBe('3 товара')
    expect(i18n.t('cart.items', { count: 11 })).toBe('11 товаров')

    await i18n.setLocale('en')

    expect(i18n.t('cart.items', { count: 1 })).toBe('1 item')
    expect(i18n.t('cart.items', { count: 3 })).toBe('3 items')
  })

  it('applies the rules of the message locale, not of the current one', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      fallbackLocale: 'ru',
      loaders: {
        ru: { cart: async () => ({ items: { one: '{count} товар', few: '{count} товара', many: '{count} товаров', other: '{count} товара' } }) },
      },
    })

    await i18n.loadBlock('cart', 'ru')

    expect(i18n.t('cart.items', { count: 3 })).toBe('3 товара')
  })

  it('keeps nested form keys addressable', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'cart', { items: { one: '{n} item', other: '{n} items' } })

    expect(i18n.t('cart.items', { n: 2 })).toBe('2 items')
    expect(i18n.t('cart.items.one')).toBe('{n} item')
  })

  it('leaves ordinary namespaces as a miss', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'ui', { actions: { save: 'Save', cancel: 'Cancel' } })

    expect(i18n.t('ui.actions')).toBe('ui.actions')
    expect(i18n.t('ui.actions.save')).toBe('Save')
  })

  it('invalidates compiled forms when the block is merged again', async () => {
    const i18n = createFintI18n({ locale: 'ru' })
    i18n.mergeMessages('ru', 'cart', { items: { one: '{n} товар', other: '{n} товара' } })
    expect(i18n.t('cart.items', { n: 1 })).toBe('1 товар')

    i18n.mergeMessages('ru', 'cart', { items: { one: '{n} штука', other: '{n} штуки' } })
    expect(i18n.t('cart.items', { n: 1 })).toBe('1 штука')
  })
})
