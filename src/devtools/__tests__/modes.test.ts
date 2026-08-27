/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createFintI18n, type FintI18n } from '../../core'
import { installI18n } from '../../vue'
import { createDevtools, pseudo } from '../index'

function mountWith(i18n: FintI18n, key: string) {
  const Component = defineComponent({ setup: () => () => h('span', i18n.t(key)) })

  return mount(Component, {
    global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
  })
}

describe('режимы диагностики', () => {
  function setup() {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello, {name}!' })
    // Прогрев вне эффекта: переключение режима обязано доставать и такие
    // компоненты, иначе половина экрана осталась бы в старом режиме.
    i18n.t('common.hello', { name: 'Alex' })

    return { i18n, devtools: createDevtools(i18n, { bridge: false }) }
  }

  it('режим ключей показывает ключ вместо перевода и снимается без следа', async () => {
    const { i18n, devtools } = setup()
    const wrapper = mountWith(i18n, 'common.hello')
    const original = wrapper.text()

    expect(original).toBe('Hello, {name}!')

    devtools.setMode('keys')
    await nextTick()
    expect(wrapper.text()).toBe('common.hello')
    expect(devtools.mode).toBe('keys')

    devtools.setMode('off')
    await nextTick()
    // Байт в байт: режим не должен оставлять следов в кэше компиляции.
    expect(wrapper.text()).toBe(original)
    expect(devtools.mode).toBe('off')
  })

  it('псевдолокализация акцентирует и растягивает, а потом снимается', async () => {
    const { i18n, devtools } = setup()
    const wrapper = mountWith(i18n, 'common.hello')
    const original = wrapper.text()

    devtools.setMode('pseudo')
    await nextTick()

    const pseudoText = wrapper.text()
    expect(pseudoText).toBe(pseudo(original))
    expect(pseudoText.startsWith('[')).toBe(true)
    expect(pseudoText.endsWith(']')).toBe(true)
    expect(pseudoText.length).toBeGreaterThan(original.length)

    devtools.setMode('off')
    await nextTick()
    expect(wrapper.text()).toBe(original)
  })

  it('оставляет промах промахом: onMissingKey срабатывает и в режиме', async () => {
    const { i18n, devtools } = setup()
    const onMissingKey = vi.fn()
    i18n.hooks.on('onMissingKey', onMissingKey)

    devtools.setMode('pseudo')

    expect(i18n.t('common.nope')).toBe('common.nope')

    // `onMissingKey` эмитится асинхронным `emit`, а devtools подписан первым —
    // второй подписчик получает вызов уже микрозадачей.
    await Promise.resolve()
    expect(onMissingKey).toHaveBeenCalledTimes(1)
  })

  it('подписчик onTranslate есть только пока режим включён', () => {
    const { i18n, devtools } = setup()

    expect(i18n.hooks.has('onTranslate')).toBe(false)

    devtools.setMode('keys')
    expect(i18n.hooks.has('onTranslate')).toBe(true)

    devtools.setMode('pseudo')
    expect(i18n.hooks.has('onTranslate')).toBe(true)

    devtools.setMode('off')
    expect(i18n.hooks.has('onTranslate')).toBe(false)
  })

  it('отцепление снимает режим вместе с подпиской', () => {
    const { i18n, devtools } = setup()

    devtools.setMode('keys')
    devtools.detach()

    expect(i18n.hooks.has('onTranslate')).toBe(false)
    expect(devtools.mode).toBe('off')
    expect(i18n.t('common.hello', { name: 'Alex' })).toBe('Hello, Alex!')
  })

  it('псевдолокализация не трогает то, что не является буквой', () => {
    expect(pseudo('{n} — 42%')).toBe('[{ñ} — 42%···]')
  })
})
