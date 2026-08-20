import { describe, it, expect } from 'vitest'
import { createFintI18n } from '@/core'
import { createVTDirective } from '../directive'
import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import type { ObjectDirective } from 'vue'

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

describe('v-t: .preserve modifier', () => {
  // Смысл `.preserve` — не затирать серверную/статическую разметку ключом,
  // когда перевод ещё не загружен.
  it('keeps existing markup when the key does not resolve', () => {
    const i18n = createFintI18n({ locale: 'en' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t.preserve="\'common.missing\'">Server text</div>',
    })

    expect(mount(TestComponent).text()).toBe('Server text')
  })

  it('replaces the markup as soon as the key resolves', async () => {
    const i18n = createFintI18n({ locale: 'en' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      props: ['msg'],
      template: '<div v-t.preserve="msg">Server text</div>',
    })

    const wrapper = mount(TestComponent, { props: { msg: 'common.missing' } })
    expect(wrapper.text()).toBe('Server text')

    i18n.mergeMessages('en', 'common', { missing: 'Loaded' })
    await wrapper.setProps({ msg: 'common.missing' })
    await nextTick()

    expect(wrapper.text()).toBe('Loaded')
  })

  it('overwrites the markup without the modifier', () => {
    const i18n = createFintI18n({ locale: 'en' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t="\'common.missing\'">Server text</div>',
    })

    expect(mount(TestComponent).text()).toBe('common.missing')
  })
})

describe('v-t: teardown', () => {
  it('stops reacting to locale changes after unmount', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.mergeMessages('ru', 'common', { hello: 'Привет' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t="\'common.hello\'"></div>',
    })

    const wrapper = mount(TestComponent)
    const el = wrapper.element as HTMLElement
    expect(el.textContent).toBe('Hello')

    wrapper.unmount()

    await i18n.setLocale('ru')
    await nextTick()

    // Эффект снят: отсоединённый узел больше не переписывается.
    expect(el.textContent).toBe('Hello')
  })

  it('unmounts cleanly even when the binding was invalid', () => {
    const i18n = createFintI18n({ locale: 'en' })

    const TestComponent = defineComponent({
      directives: { t: createVTDirective(i18n) },
      template: '<div v-t="null"></div>',
    })

    const wrapper = mount(TestComponent)

    expect(() => wrapper.unmount()).not.toThrow()
  })
})

describe('v-t: getSSRProps', () => {
  it('renders a string binding into textContent', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    const directive = createVTDirective(i18n) as ObjectDirective

    expect(directive.getSSRProps!({ value: 'common.hello' } as any, null as any))
      .toEqual({ textContent: 'Hello' })
  })

  it('renders an object binding with params', () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { welcome: 'Welcome, {name}!' })
    const directive = createVTDirective(i18n) as ObjectDirective

    expect(directive.getSSRProps!({ value: { path: 'common.welcome', params: { name: 'Ann' } } } as any, null as any))
      .toEqual({ textContent: 'Welcome, Ann!' })
  })

  it('emits nothing for an invalid binding', () => {
    const i18n = createFintI18n({ locale: 'en' })
    const directive = createVTDirective(i18n) as ObjectDirective

    expect(directive.getSSRProps!({ value: undefined } as any, null as any)).toEqual({})
  })
})
