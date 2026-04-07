/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createFintI18n, useFintI18n, useI18nScope } from '../../index'
import { installI18n } from '../plugin'
import { defineComponent, nextTick } from 'vue'

describe('Vue Reactivity', () => {
  it('should update translation when locale changes', async () => {
    const i18n = createFintI18n({
      locale: 'en',
    })
    
    i18n.mergeMessages('en', 'common', { welcome: 'Welcome' })
    i18n.mergeMessages('ru', 'common', { welcome: 'Привет' })

    const TestComponent = defineComponent({
      setup() {
        const { t, locale } = useFintI18n()
        return { t, locale }
      },
      template: '<div>{{ t("common.welcome") }}</div>'
    })

    const wrapper = mount(TestComponent, {
      global: {
        plugins: [{
          install: (app) => installI18n(app, i18n)
        }]
      }
    })

    expect(wrapper.text()).toBe('Welcome')
    
    await i18n.setLocale('ru')
    await nextTick()
    expect(wrapper.text()).toBe('Привет')
    
    i18n.locale.value = 'en'
    await nextTick()
    expect(wrapper.text()).toBe('Welcome')
  })

  it('should accept a single block name in useI18nScope', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: {
        en: {
          common: async () => ({ welcome: 'Welcome' }),
        },
      },
    })

    const ScopedComponent = defineComponent({
      async setup() {
        const { t } = await useI18nScope('common')
        return { t }
      },
      template: '<div>{{ t("common.welcome") }}</div>',
    })

    const wrapper = mount({
      components: { ScopedComponent },
      template: '<Suspense><ScopedComponent /></Suspense>',
    }, {
      global: {
        plugins: [{
          install: app => installI18n(app, i18n),
        }],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Welcome')
  })
})
