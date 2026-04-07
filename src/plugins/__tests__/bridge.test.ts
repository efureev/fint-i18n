import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref } from 'vue'
import { createFintI18n } from '../../core/instance'
import { BridgePlugin } from '../../plugins/bridge'

describe('BridgePlugin', () => {
  it('should sync locale from vue-i18n composer to fint-i18n', async () => {
    const vueI18n = {
      locale: ref('ru'),
      t: vi.fn((key: string) => key),
    }

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new BridgePlugin({ i18n: vueI18n })],
    })

    expect(i18n.locale.value).toBe('ru')

    vueI18n.locale.value = 'es'
    await nextTick()

    expect(i18n.locale.value).toBe('es')
  })

  it('should sync locale from fint-i18n to vue-i18n composer', async () => {
    const vueI18n = {
      locale: ref('en'),
      t: vi.fn((key: string) => key),
    }

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new BridgePlugin({ i18n: vueI18n })],
    })

    await i18n.setLocale('fr')

    expect(vueI18n.locale.value).toBe('fr')
  })

  it('should sync locale with a reactive legacy vue-i18n instance', async () => {
    const vueI18n = reactive({
      locale: 'en',
      t: vi.fn((key: string) => key),
    })

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new BridgePlugin({ i18n: vueI18n })],
    })

    vueI18n.locale = 'de'
    await nextTick()
    expect(i18n.locale.value).toBe('de')

    await i18n.setLocale('it')
    expect(vueI18n.locale).toBe('it')
  })

  it('should use vue-i18n as a fallback translator and forward params', () => {
    const vueI18n = {
      locale: ref('en'),
      t: vi.fn((key: string, params?: { name?: string }) => {
        if (key === 'common.greeting') {
          return `Hello ${params?.name}`
        }

        return key
      }),
    }

    const i18n = createFintI18n({
      locale: 'en',
      plugins: [new BridgePlugin({ i18n: vueI18n })],
    })

    expect(i18n.t('common.greeting', { name: 'John' })).toBe('Hello John')
    expect(vueI18n.t).toHaveBeenCalledWith('common.greeting', { name: 'John' })
    expect(i18n.t('common.missing')).toBe('common.missing')
  })
})