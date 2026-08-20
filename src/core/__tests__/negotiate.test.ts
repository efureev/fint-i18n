import { describe, expect, it } from 'vitest'
import { baseLanguage, negotiateLocale, parseAcceptLanguage } from '../negotiate'

describe('baseLanguage', () => {
  it('strips the region subtag', () => {
    expect(baseLanguage('ru-RU')).toBe('ru')
    expect(baseLanguage('zh-Hans-CN')).toBe('zh')
  })

  it('has no base language for a tag without a subtag', () => {
    expect(baseLanguage('ru')).toBeUndefined()
    expect(baseLanguage('')).toBeUndefined()
  })
})

describe('negotiateLocale', () => {
  // Критерий приёмки роадмапа #8.
  it('prefers request order over exactness of the match', () => {
    expect(negotiateLocale(['ru-RU', 'en'], ['en', 'ru'])).toBe('ru')
  })

  it('takes an exact match first', () => {
    expect(negotiateLocale(['ru-RU'], ['ru', 'ru-RU'])).toBe('ru-RU')
  })

  it('falls back from a region to its base language', () => {
    expect(negotiateLocale(['en-GB'], ['en', 'en-US'])).toBe('en')
  })

  it('falls back from a base language to any of its regions', () => {
    expect(negotiateLocale(['en'], ['en-GB', 'ru'])).toBe('en-GB')
  })

  it('accepts a bare string as the request', () => {
    expect(negotiateLocale('ru-RU', ['en', 'ru'])).toBe('ru')
  })

  it('compares case-insensitively but returns the original spelling', () => {
    expect(negotiateLocale(['RU-ru'], ['ru-RU'])).toBe('ru-RU')
    expect(negotiateLocale(['PT'], ['pt-BR'])).toBe('pt-BR')
  })

  it('returns the fallback when nothing matches', () => {
    expect(negotiateLocale(['pt-BR'], ['en', 'ru'], 'en')).toBe('en')
    expect(negotiateLocale(['pt-BR'], ['en', 'ru'])).toBeUndefined()
  })

  it('returns the fallback for empty input on either side', () => {
    expect(negotiateLocale([], ['en'], 'en')).toBe('en')
    expect(negotiateLocale(['en'], [], 'ru')).toBe('ru')
    expect(negotiateLocale(undefined, ['en'], 'en')).toBe('en')
  })

  it('keeps the first spelling when available repeats a tag', () => {
    expect(negotiateLocale(['EN'], ['en', 'EN'])).toBe('en')
  })
})

describe('parseAcceptLanguage', () => {
  it('orders tags by descending q', () => {
    expect(parseAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toEqual(['ru-RU', 'ru', 'en'])
    expect(parseAcceptLanguage('en;q=0.5,ru;q=0.9')).toEqual(['ru', 'en'])
  })

  it('keeps header order for equal q', () => {
    expect(parseAcceptLanguage('de,fr,es')).toEqual(['de', 'fr', 'es'])
  })

  it('drops the wildcard and explicit refusals', () => {
    expect(parseAcceptLanguage('ru,*;q=0.5')).toEqual(['ru'])
    expect(parseAcceptLanguage('ru,de;q=0')).toEqual(['ru'])
  })

  it('tolerates whitespace and a malformed q', () => {
    expect(parseAcceptLanguage(' ru-RU , en ; q = 0.8 ')).toEqual(['ru-RU', 'en'])
    expect(parseAcceptLanguage('ru;q=broken')).toEqual(['ru'])
  })

  it('returns an empty list for an empty header', () => {
    expect(parseAcceptLanguage('')).toEqual([])
    expect(parseAcceptLanguage('   ')).toEqual([])
    expect(parseAcceptLanguage(',,')).toEqual([])
  })

  it('ignores parameters that are not q', () => {
    expect(parseAcceptLanguage('ru;charset=utf-8,en;q=0.5')).toEqual(['ru', 'en'])
  })

  // Параметр без `=` встречается в кривых заголовках и не должен ломать разбор.
  it('survives a parameter with no value', () => {
    expect(parseAcceptLanguage('ru;broken,en;q=0.5')).toEqual(['ru', 'en'])
  })

  it('reads q wherever it sits among the parameters', () => {
    expect(parseAcceptLanguage('ru;x=1;q=0.1,en;q=0.9')).toEqual(['en', 'ru'])
  })

  it('keeps a tag whose q is above 1 rather than clamping it away', () => {
    expect(parseAcceptLanguage('ru;q=5,en')).toEqual(['ru', 'en'])
  })

  it('feeds negotiateLocale', () => {
    const requested = parseAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')

    expect(negotiateLocale(requested, ['en', 'ru'])).toBe('ru')
  })
})
