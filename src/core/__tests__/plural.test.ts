import { beforeEach, describe, expect, it, vi } from 'vitest'
import { compileTemplate } from '../compiler'
import { createFintI18n } from '../instance'
import { clearPluralCache, getPluralCategories, selectPluralCategory } from '../plural'

describe('plural rules', () => {
  beforeEach(() => {
    clearPluralCache()
  })

  it('returns CLDR categories in canonical order', () => {
    expect(getPluralCategories('en')).toEqual(['one', 'other'])
    expect(getPluralCategories('ru')).toEqual(['one', 'few', 'many', 'other'])
  })

  it('selects categories for russian', () => {
    expect(selectPluralCategory('ru', 1)).toBe('one')
    expect(selectPluralCategory('ru', 3)).toBe('few')
    expect(selectPluralCategory('ru', 7)).toBe('many')
    expect(selectPluralCategory('ru', 21)).toBe('one')
  })

  it('falls back to english rules for an invalid locale tag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(selectPluralCategory('not a locale', 1)).toBe('one')
    expect(warn).toHaveBeenCalledOnce()

    warn.mockRestore()
  })

  it('caches rules per locale', () => {
    const first = getPluralCategories('ru')
    expect(getPluralCategories('ru')).toBe(first)
  })
})

describe('compileTemplate: labelled plural', () => {
  it('picks a russian form by category', () => {
    const fn = compileTemplate('one:{n} файл | few:{n} файла | many:{n} файлов', 'ru')

    expect(fn({ n: 1 })).toBe('1 файл')
    expect(fn({ n: 3 })).toBe('3 файла')
    expect(fn({ n: 7 })).toBe('7 файлов')
    expect(fn({ n: 21 })).toBe('21 файл')
  })

  it('accepts `count` as well as `n`', () => {
    const fn = compileTemplate('one:{count} file | other:{count} files', 'en')

    expect(fn({ count: 1 })).toBe('1 file')
    expect(fn({ count: 5 })).toBe('5 files')
  })

  it('honours exact-value branches before categories', () => {
    const fn = compileTemplate('=0:нет файлов | one:{n} файл | few:{n} файла | many:{n} файлов', 'ru')

    expect(fn({ n: 0 })).toBe('нет файлов')
    expect(fn({ n: 1 })).toBe('1 файл')
    expect(fn({ n: 5 })).toBe('5 файлов')
  })

  it('falls back to `other` when the locale category has no branch', () => {
    const fn = compileTemplate('one:{n} файл | other:{n} файлов', 'ru')

    // `few` не описан — берётся `other`.
    expect(fn({ n: 3 })).toBe('3 файлов')
  })

  it('uses `other` when no count is supplied', () => {
    const fn = compileTemplate('one:{n} file | other:{n} files', 'en')

    expect(fn()).toBe('{n} files')
  })
})

describe('compileTemplate: positional plural', () => {
  it('maps branches onto the locale category order', () => {
    const ru = compileTemplate('{n} файл | {n} файла | {n} файлов | {n} файла', 'ru')

    expect(ru({ n: 1 })).toBe('1 файл')
    expect(ru({ n: 3 })).toBe('3 файла')
    expect(ru({ n: 7 })).toBe('7 файлов')
  })

  it('works with two forms in english', () => {
    const en = compileTemplate('{n} file | {n} files', 'en')

    expect(en({ n: 1 })).toBe('1 file')
    expect(en({ n: 2 })).toBe('2 files')
  })

  it('shares the last branch when there are fewer forms than categories', () => {
    const ru = compileTemplate('{n} файл | {n} файла', 'ru')

    expect(ru({ n: 1 })).toBe('1 файл')
    expect(ru({ n: 3 })).toBe('3 файла')
    expect(ru({ n: 7 })).toBe('7 файла')
  })

  it('returns the whole string when no count is supplied', () => {
    const fn = compileTemplate('Name | Email', 'en')

    expect(fn()).toBe('Name | Email')
    expect(fn({ user: 'x' })).toBe('Name | Email')
  })

  it('trims whitespace around separators', () => {
    const fn = compileTemplate('  one file   |   many files  ', 'en')

    expect(fn({ n: 1 })).toBe('one file')
    expect(fn({ n: 2 })).toBe('many files')
  })

  it('defaults to english rules without a locale', () => {
    const fn = compileTemplate('{n} file | {n} files')

    expect(fn({ n: 1 })).toBe('1 file')
    expect(fn({ n: 4 })).toBe('4 files')
  })
})

describe('compileTemplate: pipes that are not plural', () => {
  it('treats `||` as a literal pipe', () => {
    const fn = compileTemplate('a || b', 'en')

    expect(fn()).toBe('a | b')
    expect(fn({ n: 5 })).toBe('a | b')
  })

  it('keeps a literal pipe inside a plural branch', () => {
    const fn = compileTemplate('one:{n} || file | other:{n} || files', 'en')

    expect(fn({ n: 1 })).toBe('1 | file')
    expect(fn({ n: 3 })).toBe('3 | files')
  })

  it('does not treat arbitrary `word:` prefixes as labels', () => {
    const fn = compileTemplate('Note: one | Note: many', 'en')

    expect(fn({ n: 1 })).toBe('Note: one')
    expect(fn({ n: 5 })).toBe('Note: many')
  })

  it('coerces a numeric string count', () => {
    const fn = compileTemplate('{n} file | {n} files', 'en')

    expect(fn({ n: '1' })).toBe('1 file')
    expect(fn({ n: '3' })).toBe('3 files')
  })

  it('ignores a count that is not a number', () => {
    const fn = compileTemplate('{n} file | {n} files', 'en')

    expect(fn({ n: 'many' })).toBe('many file | many files')
    expect(fn({ n: null })).toBe('{n} file | {n} files')
  })
})

describe('plural through t()', () => {
  it('resolves plural forms per locale', async () => {
    const i18n = createFintI18n({
      locale: 'ru',
      loaders: {
        ru: { cart: async () => ({ items: 'one:{count} товар | few:{count} товара | many:{count} товаров' }) },
        en: { cart: async () => ({ items: 'one:{count} item | other:{count} items' }) },
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
        ru: { cart: async () => ({ items: 'one:{count} товар | few:{count} товара | many:{count} товаров' }) },
      },
    })

    await i18n.loadBlock('cart', 'ru')

    // Ключа в `en` нет — сообщение приходит из `ru` и обязано следовать
    // русским правилам, а не правилам текущей локали.
    expect(i18n.t('cart.items', { count: 3 })).toBe('3 товара')
  })
})
