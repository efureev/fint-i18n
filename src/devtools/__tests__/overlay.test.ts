/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createFintI18n } from '../../core'
import { BRIDGE_KEY, createDevtools, mountDevtoolsOverlay } from '../index'

const HOST_ID = 'fint-i18n-devtools'

function shadowText(): string {
  return document.getElementById(HOST_ID)?.shadowRoot?.textContent ?? ''
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
