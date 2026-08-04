import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearFormatterCache,
  createFormatters,
  formatDate,
  formatNumber,
  getDateTimeFormat,
  getNumberFormat,
} from '../format'

describe('formatNumber', () => {
  beforeEach(() => {
    clearFormatterCache()
  })

  it('formats by locale rules', () => {
    expect(formatNumber('en', 1234567.891)).toBe('1,234,567.891')
    // В ru-локали разделитель разрядов — неразрывный пробел.
    expect(formatNumber('ru', 1234567.891).replace(/\s/g, ' ')).toBe('1 234 567,891')
  })

  it('supports currency and percent styles', () => {
    expect(formatNumber('en', 42.5, { style: 'currency', currency: 'USD' })).toBe('$42.50')
    expect(formatNumber('en', 0.256, { style: 'percent', maximumFractionDigits: 1 })).toBe('25.6%')
  })

  it('accepts bigint', () => {
    expect(formatNumber('en', 9007199254740993n)).toBe('9,007,199,254,740,993')
  })

  it('falls back to english for an invalid locale tag', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(formatNumber('not a locale', 1234)).toBe('1,234')
    expect(warn).toHaveBeenCalledOnce()

    warn.mockRestore()
  })
})

describe('formatter cache', () => {
  beforeEach(() => {
    clearFormatterCache()
  })

  it('reuses an instance for the same locale and options', () => {
    const first = getNumberFormat('en', { style: 'currency', currency: 'EUR' })

    expect(getNumberFormat('en', { style: 'currency', currency: 'EUR' })).toBe(first)
    expect(getNumberFormat('en', { style: 'currency', currency: 'USD' })).not.toBe(first)
    expect(getNumberFormat('ru', { style: 'currency', currency: 'EUR' })).not.toBe(first)
  })

  it('does not collide between the number and date caches on the same key', () => {
    expect(getNumberFormat('en')).toBeInstanceOf(Intl.NumberFormat)
    expect(getDateTimeFormat('en')).toBeInstanceOf(Intl.DateTimeFormat)
  })

  it('drops the cache instead of growing without bound', () => {
    const first = getNumberFormat('en', { maximumFractionDigits: 1 })

    for (let i = 2; i < 72; i++) {
      getNumberFormat('en', { maximumFractionDigits: i })
    }

    expect(getNumberFormat('en', { maximumFractionDigits: 1 })).not.toBe(first)
  })
})

describe('formatDate', () => {
  beforeEach(() => {
    clearFormatterCache()
  })

  const moment = new Date(Date.UTC(2026, 7, 4, 12, 0, 0))

  it('accepts Date, timestamp and string', () => {
    const options = { dateStyle: 'short', timeZone: 'UTC' } as const

    const fromDate = formatDate('en', moment, options)

    expect(formatDate('en', moment.getTime(), options)).toBe(fromDate)
    expect(formatDate('en', '2026-08-04T12:00:00Z', options)).toBe(fromDate)
  })

  it('formats by locale rules', () => {
    const options = { dateStyle: 'long', timeZone: 'UTC' } as const

    expect(formatDate('en', moment, options)).toBe('August 4, 2026')
    expect(formatDate('ru', moment, options)).toBe('4 августа 2026 г.')
  })

  it('returns the raw value for an invalid date', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(formatDate('en', 'not a date')).toBe('not a date')
    expect(warn).toHaveBeenCalledOnce()

    warn.mockRestore()
  })
})

describe('createFormatters', () => {
  beforeEach(() => {
    clearFormatterCache()
  })

  it('reads the locale at call time', () => {
    let locale = 'en'
    const { n, d } = createFormatters(() => locale)

    expect(n(1234.5)).toBe('1,234.5')

    locale = 'ru'

    expect(n(1234.5).replace(/\s/g, ' ')).toBe('1 234,5')
    expect(d(new Date(Date.UTC(2026, 7, 4)), { dateStyle: 'long', timeZone: 'UTC' })).toBe('4 августа 2026 г.')
  })
})
