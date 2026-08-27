/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent } from 'vue'
import { createFintI18n } from '../../core'
import { connectVueDevtools, createDevtools } from '../index'

// `@vue/devtools-api` — необязательная зависимость, и её отсутствие обязано
// быть обычным делом: предупреждение с инструкцией, а не исключение.
vi.mock('@vue/devtools-api', () => {
  throw new Error('Cannot find module \'@vue/devtools-api\'')
})

describe('мост без @vue/devtools-api', () => {
  it('предупреждает и возвращает false, не роняя приложение', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const devtools = createDevtools(undefined, { bridge: false })
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { common: async () => ({ hello: 'Hello' }) } },
    })
    const app = createApp(defineComponent({ render: () => null }))

    await expect(connectVueDevtools(app, devtools)).resolves.toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@vue/devtools-api'))

    // Этапы 1–3 продолжают работать полностью.
    await i18n.loadBlock('common')
    expect(i18n.t('common.hello')).toBe('Hello')
    expect(devtools.snapshot().loadedBlocks).toEqual({ en: ['common'] })
    devtools.setMode('keys')
    expect(i18n.t('common.hello')).toBe('common.hello')

    warn.mockRestore()
  })
})
