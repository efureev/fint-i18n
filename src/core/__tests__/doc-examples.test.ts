import { describe, expect, it } from 'vitest'
import { createFintI18n } from '../instance'

/**
 * Примеры из `docs/{en,ru}/**` выполняются здесь дословно.
 * Документация уже расходилась с реализацией — тест держит её в узде.
 */
describe('docs: defining-messages → dynamic merging', () => {
  it('runs the mergeMessages example as written', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const { mergeMessages, locale } = i18n

    mergeMessages(locale.value, 'custom', {
      dynamic_key: 'Dynamic value',
    })

    mergeMessages(locale.value, 'cart', {
      items: { one: '{n} item', other: '{n} items' },
    })

    expect(i18n.t('custom.dynamic_key')).toBe('Dynamic value')
    expect(i18n.t('cart.items', { n: 1 })).toBe('1 item')
    expect(i18n.t('cart.items', { n: 5 })).toBe('5 items')
  })
})

describe('docs: api → typed message keys', () => {
  interface AppSchema {
    common: { welcome: string, user: { profile: string } }
    files: { one: string, other: string }
  }

  it('runs the schema example as written', () => {
    const i18n = createFintI18n<AppSchema>({ locale: 'en' })
    const dynamic = 'welcome'

    i18n.mergeMessages('en', 'common', { welcome: 'Hi!', user: { profile: 'Profile' } })
    i18n.mergeMessages('en', 'files', { one: '{n} file', other: '{n} files' })

    expect(i18n.t('common.welcome')).toBe('Hi!')
    expect(i18n.t('common.user.profile')).toBe('Profile')
    expect(i18n.t('files', { n: 3 })).toBe('3 files')
    expect(i18n.t(`common.${dynamic}`)).toBe('Hi!')
  })
})

describe('docs: defining-messages → plural forms', () => {
  it('runs the plural example as written', () => {
    const i18n = createFintI18n({ locale: 'ru' })

    i18n.mergeMessages('en', 'x', {
      files: { '=0': 'no files', 'one': '{n} file', 'other': '{n} files' },
    })
    i18n.mergeMessages('ru', 'x', {
      filesRu: { one: '{n} файл', few: '{n} файла', many: '{n} файлов', other: '{n} файла' },
    })

    expect(i18n.t('x.filesRu', { n: 1 })).toBe('1 файл')
    expect(i18n.t('x.filesRu', { n: 3 })).toBe('3 файла')
    expect(i18n.t('x.filesRu', { n: 7 })).toBe('7 файлов')

    i18n.fallbackLocale = 'en'
    expect(i18n.t('x.files', { n: 0 })).toBe('no files')
  })
})

describe('docs: api → pluralization overview', () => {
  it('runs the cart example as written', () => {
    const i18n = createFintI18n({ locale: 'ru' })

    i18n.mergeMessages('ru', 'cart', {
      items: {
        '=0': 'корзина пуста',
        'one': '{count} товар',
        'few': '{count} товара',
        'many': '{count} товаров',
        'other': '{count} товара',
      },
    })

    expect(i18n.t('cart.items', { count: 0 })).toBe('корзина пуста')
    expect(i18n.t('cart.items', { count: 1 })).toBe('1 товар')
    expect(i18n.t('cart.items', { count: 3 })).toBe('3 товара')
    expect(i18n.t('cart.items', { count: 11 })).toBe('11 товаров')
  })
})
