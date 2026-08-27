/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createFintI18n } from '../../core'
import { installI18n } from '../../vue'
import { BRIDGE_KEY, createDevtools, mountDevtoolsOverlay } from '../index'

const HOST_ID = 'fint-i18n-devtools'

function shadowText(): string {
  return document.getElementById(HOST_ID)?.shadowRoot?.textContent ?? ''
}

function clickButton(match: (button: HTMLButtonElement) => boolean): void {
  const buttons = [...document.getElementById(HOST_ID)!.shadowRoot!.querySelectorAll('button')]
  const target = buttons.find(button => match(button))

  if (!target) throw new Error('кнопка не найдена в панели')
  target.click()
}

/** Панель пересчитывается в микрозадаче, поэтому ждём её, а не только рендер. */
async function settle() {
  await Promise.resolve()
  await nextTick()
}

afterEach(() => {
  document.getElementById(HOST_ID)?.remove()
  delete (window as any)[BRIDGE_KEY]
})

describe('оверлей', () => {
  it('показывает загруженный блок со счётчиком использований', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({
      locale: 'en',
      plugins: [devtools],
      loaders: { en: { auth: async () => ({ login: 'Sign in' }) } },
    })

    const unmount = await mountDevtoolsOverlay(devtools)

    i18n.registerUsage('auth')
    i18n.registerUsage('auth')
    await i18n.loadBlock('auth')
    await settle()

    const text = shadowText()
    expect(text).toContain('auth')
    expect(text).toContain('loaded')
    // Счётчик использований — это то, чего нет ни в одном публичном методе.
    expect(text).toMatch(/auth[\s\S]*en[\s\S]*loaded[\s\S]*2/)

    unmount()
  })

  it('живёт в Shadow DOM и не оставляет следов после размонтирования', async () => {
    const devtools = createDevtools()
    createFintI18n({ locale: 'en', plugins: [devtools] })

    const unmount = await mountDevtoolsOverlay(devtools)

    const host = document.getElementById(HOST_ID)
    expect(host).not.toBeNull()
    expect(host!.shadowRoot).not.toBeNull()
    // Стили уезжают в теневой корень, а не в документ.
    expect(document.head.querySelector('style')).toBeNull()

    unmount()
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('снимает подписку на ленту при размонтировании', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

    const stops: ReturnType<typeof vi.fn>[] = []
    const subscribe = devtools.subscribe
    devtools.subscribe = (listener) => {
      const stop = vi.fn(subscribe(listener))
      stops.push(stop)
      return stop
    }

    const unmount = await mountDevtoolsOverlay(devtools)
    expect(stops).toHaveLength(1)

    unmount()
    expect(stops[0]).toHaveBeenCalledTimes(1)

    // Подписки нет — событие после размонтирования панель не воскрешает.
    i18n.mergeMessages('en', 'common', { k: 'v' })
    await settle()
    expect(document.getElementById(HOST_ID)).toBeNull()
  })

  it('переключается горячей клавишей', async () => {
    const devtools = createDevtools()
    createFintI18n({ locale: 'en', plugins: [devtools] })

    const unmount = await mountDevtoolsOverlay(devtools, { collapsed: true })
    await settle()

    expect(shadowText()).not.toContain('dictionary')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'i', altKey: true }))
    await settle()

    expect(shadowText()).toContain('dictionary')

    unmount()
  })

  it('показывает промахи и фолбэки со счётчиками', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'ru', fallbackLocale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'common', { only: 'English only' })

    const unmount = await mountDevtoolsOverlay(devtools)

    i18n.t('common.only')
    i18n.t('common.only')
    i18n.t('common.gone')
    await settle()

    document.getElementById(HOST_ID)!.shadowRoot!
      .querySelectorAll('button')
      .forEach((button) => { if (button.textContent?.startsWith('missing')) button.click() })
    await settle()

    const text = shadowText()
    expect(text).toContain('common.only')
    expect(text).toContain('from en')
    expect(text).toContain('common.gone')

    unmount()
  })

  it('переключает режим кнопкой в шапке и перерисовывает страницу', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const Page = defineComponent({ setup: () => () => h('span', i18n.t('common.hello')) })
    const page = mount(Page, { global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] } })
    expect(page.text()).toBe('Hello')

    const unmount = await mountDevtoolsOverlay(devtools)
    await settle()

    clickButton(button => button.textContent?.trim() === 'keys')
    await settle()

    expect(page.text()).toBe('common.hello')
    expect(devtools.mode).toBe('keys')

    clickButton(button => button.textContent?.trim() === 'off')
    await settle()

    expect(page.text()).toBe('Hello')

    unmount()
    page.unmount()
  })

  it('правит перевод прямо в таблице словаря', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const unmount = await mountDevtoolsOverlay(devtools)
    clickButton(button => button.textContent?.startsWith('dictionary') ?? false)
    await settle()

    const input = document.getElementById(HOST_ID)!.shadowRoot!.querySelector('input.edit') as HTMLInputElement
    expect(input.value).toBe('Hello')

    input.value = 'Edited'
    input.dispatchEvent(new Event('change'))
    await settle()

    expect(i18n.t('common.hello')).toBe('Edited')

    unmount()
  })

  it('перезагружает блок кнопкой в строке', async () => {
    let payload = 'Hello'
    const loader = vi.fn(async () => ({ hello: payload }))
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools], loaders: { en: { common: loader } } })

    await i18n.loadBlock('common')
    const unmount = await mountDevtoolsOverlay(devtools)
    await settle()

    payload = 'Reloaded'
    clickButton(button => button.getAttribute('title') === 'Reload')
    await settle()
    await settle()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('common.hello')).toBe('Reloaded')

    unmount()
  })

  it('включает сбор метрик только на время открытой вкладки', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const unmount = await mountDevtoolsOverlay(devtools)
    await settle()

    expect(i18n.hooks.has('onTranslate')).toBe(false)

    clickButton(button => button.textContent?.startsWith('metrics') ?? false)
    await settle()

    expect(i18n.hooks.has('onTranslate')).toBe(true)
    expect(shadowText()).toContain('costs about 17%')

    i18n.t('common.hello')
    i18n.t('common.hello')

    // Счётчики растут без событий ленты — панель их опрашивает, а не ждёт.
    await new Promise(resolve => setTimeout(resolve, 700))
    await settle()
    expect(shadowText()).toContain('common.hello')

    // Ушли с вкладки — подписка снимается сама.
    clickButton(button => button.textContent?.startsWith('blocks') ?? false)
    await settle()
    expect(i18n.hooks.has('onTranslate')).toBe(false)

    unmount()
  })

  it('размонтирование с открытой вкладкой метрик тоже снимает сбор', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

    const unmount = await mountDevtoolsOverlay(devtools)
    await settle()
    clickButton(button => button.textContent?.startsWith('metrics') ?? false)
    await settle()
    expect(i18n.hooks.has('onTranslate')).toBe(true)

    unmount()
    expect(i18n.hooks.has('onTranslate')).toBe(false)
  })

  it('без document возвращает пустое размонтирование', async () => {
    const devtools = createDevtools()
    createFintI18n({ locale: 'en', plugins: [devtools] })

    const original = globalThis.document
    // @ts-expect-error проверяем ветку для сервера
    delete globalThis.document

    const unmount = await mountDevtoolsOverlay(devtools)
    expect(() => unmount()).not.toThrow()

    globalThis.document = original
  })
})
