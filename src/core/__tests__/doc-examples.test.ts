import { describe, expect, it, vi } from 'vitest'
import { warn } from '../hooks'
import { createFintI18n } from '../instance'
import { negotiateLocale, parseAcceptLanguage } from '../negotiate'

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

describe('docs: blocks → regional subtags', () => {
  it('serves ru-RU from the ru loader and stores it under ru-RU', async () => {
    const i18n = createFintI18n({
      locale: 'ru-RU',
      loaders: { ru: { common: () => Promise.resolve({ title: 'Заголовок' }) } },
    })

    await i18n.loadBlock('common')

    expect(i18n.t('common.title')).toBe('Заголовок')
    expect(Object.keys(i18n.messages)).toEqual(['ru-RU'])
  })
})

describe('docs: api → locale negotiation', () => {
  it('runs the browser example as written', () => {
    const languages = ['ru-RU', 'ru', 'en-US']

    expect(negotiateLocale(languages, ['en', 'ru'], 'en')).toBe('ru')
  })

  it('runs the server example as written', () => {
    const requested = parseAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')

    expect(requested).toEqual(['ru-RU', 'ru', 'en'])
    expect(negotiateLocale(requested, ['en', 'ru'], 'en')).toBe('ru')
  })

  it('applies the fallback when nothing matches', () => {
    expect(negotiateLocale(['pt-BR'], ['en', 'ru'], 'en')).toBe('en')
  })
})

describe('docs: plugins → onWarning', () => {
  it('runs the subscriber example as written', async () => {
    const i18n = createFintI18n({ locale: 'en', loaders: { en: {} } })
    const reportToSentry = vi.fn()

    i18n.hooks.on('onWarning', ({ code, message, context }) => {
      if (code === 'no-loader') reportToSentry(message, context)
    })

    await i18n.loadBlock('nope')

    expect(reportToSentry).toHaveBeenCalledWith(
      'No loader for block "nope" in locale "en"',
      { block: 'nope', locale: 'en' },
    )
  })

  it('runs the plugin-side warn() example as written', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const seen: unknown[] = []
    i18n.hooks.on('onWarning', payload => { seen.push(payload) })

    warn(i18n.hooks, 'my-plugin:stale-cache', 'Кэш устарел', { age: 3600 })

    expect(seen).toEqual([
      { code: 'my-plugin:stale-cache', message: 'Кэш устарел', context: { age: 3600 } },
    ])
  })
})

describe('docs: installation → a package that reads its block through t()', () => {
  // Пакет-донор вроде `@feugene/granularity`: компоненты читают `gr.*` через
  // `t()` и `useI18nScope` не зовут, поэтому блок регистрирует приложение.
  const GRANULARITY_I18N_BLOCK = 'gr'
  const granularityEn = { en: { gr: () => Promise.resolve({ pagination: { prev: 'Prev' } }) } }
  const granularityRu = { ru: { gr: () => Promise.resolve({ pagination: { prev: 'Назад' } }) } }

  it('leaves the block unloaded when nobody registers it', async () => {
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en', loaders: [granularityEn, granularityRu] })

    await i18n.loadUsedBlocks(i18n.locale.value)

    expect(i18n.te('gr.pagination.prev')).toBe(false)
  })

  it('runs the registerBlocks example as written', async () => {
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en', loaders: [granularityEn, granularityRu] })

    i18n.registerBlocks([GRANULARITY_I18N_BLOCK])
    await i18n.loadUsedBlocks(i18n.locale.value)
    expect(i18n.t('gr.pagination.prev')).toBe('Назад')

    // `setLocale()` догружает зарегистрированные блоки до переключения.
    await i18n.setLocale('en')
    expect(i18n.t('gr.pagination.prev')).toBe('Prev')
  })
})
