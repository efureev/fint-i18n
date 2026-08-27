import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'
import { getSSRState } from '../ssr'
import type { FintI18n } from '../instance'
import type { WarningCode } from '../hooks'

interface Warning {
  code: WarningCode
  message: string
  context?: Record<string, unknown>
}

function collect(i18n: FintI18n): Warning[] {
  const seen: Warning[] = []
  i18n.hooks.on('onWarning', (payload) => { seen.push(payload) })
  return seen
}

/**
 * Канал существует затем, чтобы конфигурационная ошибка была видна не только
 * тому, кто открыл консоль. Отсюда и главная проверка каждого случая: с
 * подписчиком консоль молчит, без подписчика — говорит.
 */
describe('onWarning', () => {
  it('нет лоадера для блока', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = createFintI18n({ locale: 'en', loaders: { en: {} } })
    const seen = collect(i18n)

    await i18n.loadBlock('nope')

    expect(seen).toEqual([{
      code: 'no-loader',
      message: 'No loader for block "nope" in locale "en"',
      context: { block: 'nope', locale: 'en' },
    }])
    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it('без подписчика остаётся console.warn с прежним текстом', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i18n = createFintI18n({ locale: 'en', loaders: { en: {} } })

    await i18n.loadBlock('nope')

    expect(warn).toHaveBeenCalledWith('[fint-i18n] No loader for block "nope" in locale "en"')

    warn.mockRestore()
  })

  it('паттерн ничего не развернул — и при загрузке, и при регистрации', async () => {
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: async () => ({ k: 'v' }) } } })
    const seen = collect(i18n)

    await i18n.loadBlock('nothing.*')
    i18n.registerUsage('nothing.**')

    expect(seen.map(warning => warning.code)).toEqual(['pattern-no-match', 'pattern-no-match'])
    // Локаль есть только у загрузки: регистрация использования её не знает.
    expect(seen[0].context).toEqual({ pattern: 'nothing.*', locale: 'en' })
    expect(seen[1].context).toEqual({ pattern: 'nothing.**' })
  })

  it('запись в locale.value — один раз за жизнь инстанса', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const seen = collect(i18n)

    i18n.locale.value = 'ru'
    i18n.locale.value = 'de'

    expect(seen.map(warning => warning.code)).toEqual(['deprecated-locale-setter'])
  })

  it('функции-сообщения в SSR-снимке', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { fn: () => 'computed' })
    const seen = collect(i18n)

    getSSRState(i18n)

    expect(seen[0].code).toBe('ssr-function-messages')
    expect(seen[0].context).toEqual({ paths: ['en.common.fn'] })
  })
})
