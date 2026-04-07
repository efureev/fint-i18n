import { describe, it, expect } from 'vitest'
import { createFintI18n } from '@/core'
import { createVTDirective } from '../directive'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'

describe('v-t Directive', () => {
  it('should render simple string key', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t="\'common.hello\'"></div>'
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.text()).toBe('Hello')
  })

  it('should render with object value (path and params)', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { welcome: 'Welcome, {name}!' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t="{ path: \'common.welcome\', params: { name: \'John\' } }"></div>'
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.text()).toBe('Welcome, John!')
  })

  it('should update text when locale changes and component re-renders', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.mergeMessages('ru', 'common', { hello: 'Привет' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      setup() {
        return { locale: i18n.locale }
      },
      template: '<div v-t="\'common.hello\'" :data-locale="locale"></div>'
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.text()).toBe('Hello')

    await i18n.setLocale('ru')
    await nextTick()
    
    expect(wrapper.text()).toBe('Привет')
  })

  it('should update when binding value changes', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello', bye: 'Goodbye' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      props: ['msgKey'],
      template: '<div v-t="msgKey"></div>'
    })

    const wrapper = mount(TestComponent, { props: { msgKey: 'common.hello' } })
    expect(wrapper.text()).toBe('Hello')

    await wrapper.setProps({ msgKey: 'common.bye' })
    expect(wrapper.text()).toBe('Goodbye')
  })

  it('should honor .once modifier', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello', hi: 'Hi' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      props: ['msg'],
      template: '<div v-t.once="msg"></div>'
    })

    const wrapper = mount(TestComponent, { props: { msg: 'common.hello' } })
    expect(wrapper.text()).toBe('Hello')

    await wrapper.setProps({ msg: 'common.hi' })
    expect(wrapper.text()).toBe('Hello') // Should not change
  })

  it('should return early on invalid value', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const directive = createVTDirective(i18n)
    const el = document.createElement('div')
    el.textContent = 'original'
    
    // @ts-expect-error: testing invalid input
    directive.mounted(el, { value: null, modifiers: {} })
    expect(el.textContent).toBe('original')
  })
})
