import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

function ruLoaders() {
  return {
    ru: {
      common: vi.fn(async () => ({
        title: 'Заголовок',
        items: { one: '{n} товар', few: '{n} товара', many: '{n} товаров', other: '{n} товара' },
      })),
    },
  }
}

describe('regional subtag resolution', () => {
  // Критерий приёмки роадмапа #8.
  it('loads a block registered under the base language', async () => {
    const loaders = ruLoaders()
    const i18n = createFintI18n({ locale: 'ru-RU', loaders })

    await i18n.loadBlock('common')

    expect(loaders.ru.common).toHaveBeenCalledTimes(1)
    expect(i18n.t('common.title')).toBe('Заголовок')
  })

  it('merges the messages under the requested locale, not the base one', async () => {
    const i18n = createFintI18n({ locale: 'ru-RU', loaders: ruLoaders() })

    await i18n.loadBlock('common')

    expect(i18n.messages['ru-RU']).toBeDefined()
    expect(i18n.messages.ru).toBeUndefined()
    expect(i18n.isBlockLoaded('common', 'ru-RU')).toBe(true)
  })

  it('keeps the region for Intl: ru-RU still gets Russian plural rules', async () => {
    const i18n = createFintI18n({ locale: 'ru-RU', loaders: ruLoaders() })

    await i18n.loadBlock('common')

    expect(i18n.t('common.items', { n: 1 })).toBe('1 товар')
    expect(i18n.t('common.items', { n: 3 })).toBe('3 товара')
    expect(i18n.t('common.items', { n: 5 })).toBe('5 товаров')
  })

  it('prefers a loader registered for the exact regional locale', async () => {
    const base = vi.fn(async () => ({ title: 'Заголовок' }))
    const regional = vi.fn(async () => ({ title: 'Заголовок РФ' }))
    const i18n = createFintI18n({
      locale: 'ru-RU',
      loaders: { 'ru': { common: base }, 'ru-RU': { common: regional } },
    })

    await i18n.loadBlock('common')

    expect(regional).toHaveBeenCalledTimes(1)
    expect(base).not.toHaveBeenCalled()
    expect(i18n.t('common.title')).toBe('Заголовок РФ')
  })

  it('does not resolve a base language from a region', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const regional = vi.fn(async () => ({ title: 'Заголовок РФ' }))
    const i18n = createFintI18n({ locale: 'ru', loaders: { 'ru-RU': { common: regional } } })

    await i18n.loadBlock('common')

    expect(regional).not.toHaveBeenCalled()
    expect(i18n.t('common.title')).toBe('common.title')
    warn.mockRestore()
  })

  it('switches into a regional locale and back', async () => {
    const loaders = {
      en: { common: vi.fn(async () => ({ title: 'Title' })) },
      ru: { common: vi.fn(async () => ({ title: 'Заголовок' })) },
    }
    const i18n = createFintI18n({ locale: 'en', loaders })

    await i18n.loadBlock('common')
    expect(i18n.t('common.title')).toBe('Title')

    await i18n.setLocale('ru-RU')
    await i18n.loadBlock('common')
    expect(i18n.t('common.title')).toBe('Заголовок')

    await i18n.setLocale('en')
    expect(i18n.t('common.title')).toBe('Title')
  })
})
