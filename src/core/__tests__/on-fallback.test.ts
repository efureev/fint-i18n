import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

/**
 * Единственный сигнал непереведённого контента: результат отдан, но пришёл он
 * из запасной локали. От `onMissingKey` отличается тем, что перевод всё-таки
 * есть — просто не на том языке.
 */
describe('onFallback', () => {
  function setup() {
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en' })
    i18n.mergeMessages('en', 'common', { only: 'English only', both: 'Both' })
    i18n.mergeMessages('ru', 'common', { both: 'Оба' })
    return i18n
  }

  it('срабатывает, когда результат дала запасная локаль', () => {
    const i18n = setup()
    const onFallback = vi.fn()
    i18n.hooks.on('onFallback', onFallback)

    expect(i18n.t('common.only')).toBe('English only')

    expect(onFallback).toHaveBeenCalledTimes(1)
    expect(onFallback).toHaveBeenCalledWith({
      key: 'common.only',
      locale: 'ru',
      fallbackLocale: 'en',
    })
  })

  it('молчит, когда ключ нашёлся в текущей локали', () => {
    const i18n = setup()
    const onFallback = vi.fn()
    i18n.hooks.on('onFallback', onFallback)

    expect(i18n.t('common.both')).toBe('Оба')

    expect(onFallback).not.toHaveBeenCalled()
  })

  it('молчит при промахе: там ключа нет нигде, это onMissingKey', () => {
    const i18n = setup()
    const onFallback = vi.fn()
    const onMissingKey = vi.fn()
    i18n.hooks.on('onFallback', onFallback)
    i18n.hooks.on('onMissingKey', onMissingKey)

    expect(i18n.t('common.nowhere')).toBe('common.nowhere')

    expect(onFallback).not.toHaveBeenCalled()
    expect(onMissingKey).toHaveBeenCalledTimes(1)
  })

  it('учитывает запасную локаль, заданную в самом вызове', () => {
    const i18n = createFintI18n({ locale: 'ru' })
    i18n.mergeMessages('de', 'common', { only: 'Nur Deutsch' })
    const onFallback = vi.fn()
    i18n.hooks.on('onFallback', onFallback)

    expect(i18n.t('common.only', undefined, { fallbackLocale: 'de' })).toBe('Nur Deutsch')

    expect(onFallback).toHaveBeenCalledWith({
      key: 'common.only',
      locale: 'ru',
      fallbackLocale: 'de',
    })
  })
})
