/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '@feugene/fint-i18n/core'
import { installI18n } from '@feugene/fint-i18n/vue'
import Playground from '../Playground.vue'
import { loaders } from '../i18n/messages'

const mountedWrappers: ReturnType<typeof mount>[] = []

afterEach(() => {
  for (const wrapper of mountedWrappers.splice(0, mountedWrappers.length)) {
    wrapper.unmount()
  }
})

const settleUi = async (cycles = 3) => {
  await vi.dynamicImportSettled()

  for (let index = 0; index < cycles; index++) {
    await flushPromises()
    await nextTick()
  }
}

const mountPlayground = async () => {
  const i18n = createFintI18n({
    locale: 'en',
    fallbackLocale: 'en',
    loaders,
  })

  const wrapper = mount({
    components: { Playground },
    template: '<Suspense><Playground /></Suspense>',
  }, {
    global: {
      plugins: [{
        install: app => installI18n(app, i18n),
      }],
    },
  })

  mountedWrappers.push(wrapper)

  await settleUi()
  return { wrapper }
}

describe('Playground', () => {
  it('renders runtime debug panel as part of page flow without viewport-locked scrolling', async () => {
    const { wrapper } = await mountPlayground()

    const debugPanel = wrapper.get('aside')

    expect(debugPanel.classes()).not.toContain('max-h-screen')
    expect(debugPanel.classes()).not.toContain('overflow-y-auto')
  })

  it('switches locale across the UI and keeps v-t.once static', async () => {
    const { wrapper } = await mountPlayground()

    expect(wrapper.text()).toContain('Welcome, Senior Developer!')
    expect(wrapper.text()).toContain('Reactive `v-t`')
    expect(wrapper.text()).toContain('Static `v-t.once`')

    await wrapper.get('[data-test="toggle-locale"]').trigger('click')
    await settleUi()

    expect(wrapper.text()).toContain('Добро пожаловать, Senior Developer!')
    expect(wrapper.text()).toContain('Реактивный `v-t`')
    expect(wrapper.text()).toContain('Switch Language')
  })

  it('loads lazy and nested blocks and records runtime hooks', async () => {
    const { wrapper } = await mountPlayground()

    expect(wrapper.text()).toContain('No hooks emitted yet')

    await wrapper.get('[data-test="load-auth"]').trigger('click')
    await settleUi(5)

    expect(wrapper.text()).toContain('Auth Block')
    expect(wrapper.text()).toContain('Lazy loaded')
    expect(wrapper.text()).toContain('beforeLoadBlock')
    expect(wrapper.text()).toContain('afterLoadBlock')

    await wrapper.get('[data-test="load-articles"]').trigger('click')
    await settleUi()
    await wrapper.get('[data-test="load-page"]').trigger('click')
    await settleUi()

    expect(wrapper.text()).toContain('Articles')
    expect(wrapper.text()).toContain('Full page data')
    expect(wrapper.text()).toContain('Terms')
  })
})