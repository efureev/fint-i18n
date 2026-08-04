import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../../core/instance'
import { installI18n } from '../plugin'
import { useI18nScopeSync } from '../scope'
import type { I18nScopeSync } from '../scope'

function mountScope(i18n: ReturnType<typeof createFintI18n>, blocks: string[]) {
  let scope: I18nScopeSync

  const Component = defineComponent({
    setup() {
      scope = useI18nScopeSync(blocks)
      return {}
    },
    template: `<div />`,
  })

  mount(Component, {
    global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
  })

  return scope!
}

const settle = () => new Promise(resolve => setTimeout(resolve, 10))

describe('useI18nScopeSync failure handling', () => {
  it('finishes loading and exposes the error when a loader rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('boom')
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { bad: async () => { throw boom } } },
    })

    const scope = mountScope(i18n, ['bad'])
    expect(scope.ready.value).toBe(false)
    expect(scope.error.value).toBeNull()

    await settle()

    expect(scope.ready.value).toBe(true)
    expect(scope.error.value).toBe(boom)
    expect(error).toHaveBeenCalled()

    error.mockRestore()
  })

  it('reports an error but still loads the blocks that succeeded', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          good: async () => ({ k: 'value' }),
          bad: async () => { throw new Error('boom') },
        },
      },
    })

    const scope = mountScope(i18n, ['good', 'bad'])
    await settle()

    expect(scope.ready.value).toBe(true)
    expect(scope.error.value).toBeInstanceOf(Error)
    expect(scope.t('good.k')).toBe('value')

    error.mockRestore()
  })

  it('leaves error null on a successful load', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { good: async () => ({ k: 'value' }) } },
    })

    const scope = mountScope(i18n, ['good'])
    await settle()

    expect(scope.ready.value).toBe(true)
    expect(scope.error.value).toBeNull()
    expect(scope.t('good.k')).toBe('value')
  })
})
