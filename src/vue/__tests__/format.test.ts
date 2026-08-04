import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearFormatterCache } from '../../core/format'
import { createFintI18n } from '../../core/instance'
import { useI18nFormat } from '../format'
import { installI18n } from '../plugin'

function mountWithI18n(i18n: ReturnType<typeof createFintI18n>, component: ReturnType<typeof defineComponent>) {
  return mount(component, {
    global: {
      plugins: [{ install: (app: any) => installI18n(app, i18n) }],
    },
  })
}

describe('useI18nFormat', () => {
  beforeEach(() => {
    clearFormatterCache()
  })

  it('renders numbers and dates by the current locale', () => {
    const i18n = createFintI18n({ locale: 'en' })

    const Component = defineComponent({
      setup() {
        const { n, d } = useI18nFormat()
        return { n, d, moment: new Date(Date.UTC(2026, 7, 4)) }
      },
      template: `<div>{{ n(1234.5) }}|{{ d(moment, { dateStyle: 'long', timeZone: 'UTC' }) }}</div>`,
    })

    const wrapper = mountWithI18n(i18n, Component)

    expect(wrapper.text()).toBe('1,234.5|August 4, 2026')
  })

  it('re-renders after setLocale', async () => {
    const i18n = createFintI18n({ locale: 'en' })

    const Component = defineComponent({
      setup() {
        const { n } = useI18nFormat()
        return { n }
      },
      template: `<div>{{ n(1234.5) }}</div>`,
    })

    const wrapper = mountWithI18n(i18n, Component)
    expect(wrapper.text()).toBe('1,234.5')

    await i18n.setLocale('ru')
    await nextTick()

    expect(wrapper.text().replace(/\s/g, ' ')).toBe('1 234,5')
  })

  it('shares one formatter set per instance', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const seen: unknown[] = []

    const Component = defineComponent({
      setup() {
        seen.push(useI18nFormat())
        return {}
      },
      template: `<div />`,
    })

    mountWithI18n(i18n, Component)
    mountWithI18n(i18n, Component)

    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })

  it('throws without an installed instance', () => {
    const Component = defineComponent({
      setup() {
        useI18nFormat()
        return {}
      },
      template: `<div />`,
    })

    expect(() => mount(Component)).toThrow('[fint-i18n] Instance not found')
  })
})
