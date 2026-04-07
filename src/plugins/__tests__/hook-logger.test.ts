import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '@/core'
import { HookLoggerPlugin } from '@/plugins'

describe('HookLoggerPlugin', () => {
  it('should log all called hooks to the configured logger', async () => {
    const logger = vi.fn()

    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          common: async () => ({ greeting: 'Hello {name}' })
        },
        fr: {
          common: async () => ({ greeting: 'Bonjour {name}' })
        }
      },
      plugins: [new HookLoggerPlugin({ logger })]
    })

    expect(logger).toHaveBeenNthCalledWith(1, '[fint-i18n] Hook "afterInit" called', undefined)

    await i18n.loadBlock('common')
    i18n.t('common.greeting', { name: 'John' })
    i18n.t('common.missing')
    await i18n.setLocale('fr')

    expect(logger).toHaveBeenCalledWith('[fint-i18n] Hook "beforeLoadBlock" called', 'common')
    expect(logger).toHaveBeenCalledWith(
      '[fint-i18n] Hook "afterLoadBlock" called',
      { block: 'common', locale: 'en', messages: { greeting: 'Hello {name}' } }
    )
    expect(logger).toHaveBeenCalledWith(
      '[fint-i18n] Hook "onTranslate" called',
      { key: 'common.greeting', params: { name: 'John' }, result: 'Hello John' }
    )
    expect(logger).toHaveBeenCalledWith(
      '[fint-i18n] Hook "onTranslate" called',
      { key: 'common.missing', params: undefined, result: undefined }
    )
    expect(logger).toHaveBeenCalledWith(
      '[fint-i18n] Hook "onMissingKey" called',
      { key: 'common.missing', locale: 'en' }
    )
    expect(logger).toHaveBeenCalledWith(
      '[fint-i18n] Hook "onLocaleChange" called',
      { locale: 'fr', previous: 'en' }
    )
  })
})
