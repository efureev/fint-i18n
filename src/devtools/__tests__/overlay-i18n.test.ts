/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createFintI18n } from '../../core'
import { BRIDGE_KEY, createDevtools, mountDevtoolsOverlay } from '../index'
import { createPanelI18n } from '../overlay/i18n'

const HOST_ID = 'fint-i18n-devtools'
const shadow = () => document.getElementById(HOST_ID)!.shadowRoot!
const tabs = () => [...shadow().querySelectorAll('.tabs button')].map(button => button.textContent.trim())

/**
 * Смена языка панели ждёт загрузки её словаря: `setLocale()` не переключает
 * локаль, пока блок не приехал, — иначе на экране мелькнули бы голые ключи.
 * Поэтому здесь нужен именно `dynamicImportSettled`, а не пара тиков.
 */
async function settle() {
  await vi.dynamicImportSettled()
  await nextTick()
  await nextTick()
}

afterEach(() => {
  document.getElementById(HOST_ID)?.remove()
  delete (window as any)[BRIDGE_KEY]
})

describe('словарь панели', () => {
  it('отдаёт подписи без имени блока', async () => {
    const panel = await createPanelI18n('en')

    expect(panel.t('tabs.blocks')).toBe('blocks')
    panel.dispose()
  })

  it('переводит на русский и обратно', async () => {
    const panel = await createPanelI18n('ru')
    expect(panel.t('tabs.blocks')).toBe('блоки')

    panel.follow('en')
    await settle()
    expect(panel.t('tabs.blocks')).toBe('blocks')

    panel.dispose()
  })

  it('незнакомую локаль сводит к английскому', async () => {
    const panel = await createPanelI18n('es')
    expect(panel.t('tabs.blocks')).toBe('blocks')

    // Региональный подтег доезжает до базового языка.
    const regional = await createPanelI18n('ru-RU')
    expect(regional.t('tabs.blocks')).toBe('блоки')

    panel.dispose()
    regional.dispose()
  })

  it('склоняет по правилам локали — на своём же движке', async () => {
    const panel = await createPanelI18n('ru')

    expect(panel.t('missing.wrote', { count: 1 })).toBe('записан 1 файл')
    expect(panel.t('missing.wrote', { count: 3 })).toBe('записано 3 файла')
    expect(panel.t('missing.wrote', { count: 7 })).toBe('записано 7 файлов')

    panel.dispose()
  })
})

describe('панель и локаль приложения', () => {
  it('следует за сменой языка приложения', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    const unmount = await mountDevtoolsOverlay(devtools, { storage: false })
    await settle()

    expect(tabs()[1]).toBe('blocks0')

    await i18n.setLocale('ru')
    await settle()

    expect(tabs()[1]).toBe('блоки0')

    unmount()
  })

  it('заданная явно локаль панели не следует за приложением', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    const unmount = await mountDevtoolsOverlay(devtools, { storage: false, locale: 'ru' })
    await settle()

    expect(tabs()[1]).toBe('блоки0')

    await i18n.setLocale('en')
    await settle()

    expect(tabs()[1]).toBe('блоки0')

    unmount()
  })

  it('на языке, которого у панели нет, показывает английский', async () => {
    const devtools = createDevtools()
    createFintI18n({ locale: 'es', plugins: [devtools] })
    const unmount = await mountDevtoolsOverlay(devtools, { storage: false })
    await settle()

    expect(tabs()[1]).toBe('blocks0')

    unmount()
  })
})

describe('изоляция словаря панели', () => {
  it('не попадает в наблюдения приложения', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'app', { hello: 'Hello' })

    const unmount = await mountDevtoolsOverlay(devtools, { storage: false })
    await settle()

    const snapshot = devtools.snapshot()

    // Блок панели живёт на своём инстансе: в таблице блоков, словаре и
    // счётчиках приложения его быть не должно.
    expect(snapshot.blocks.map(block => block.block)).not.toContain('panel')
    expect(Object.keys(snapshot.messages.en)).toEqual(['app'])
    expect(snapshot.usage.panel).toBeUndefined()
    expect(devtools.dictionary().map(entry => entry.key)).toEqual(['app.hello'])

    unmount()
  })

  it('режим ключей не переводит панель саму в ключи', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'app', { hello: 'Hello' })

    const unmount = await mountDevtoolsOverlay(devtools, { storage: false })
    await settle()

    devtools.setMode('keys')
    await settle()

    // Приложение показывает ключи, панель — свои подписи. Иначе инструмент
    // диагностики ломался бы ровно тогда, когда он нужен.
    expect(i18n.t('app.hello')).toBe('app.hello')
    expect(tabs()[1]).toBe('blocks0')

    devtools.setMode('pseudo')
    await settle()
    expect(tabs()[1]).toBe('blocks0')

    unmount()
  })

  it('метрики приложения не считают вызовы панели', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
    i18n.mergeMessages('en', 'app', { hello: 'Hello' })

    const unmount = await mountDevtoolsOverlay(devtools, { storage: false })
    await settle()

    devtools.metrics.enable()
    i18n.t('app.hello')
    await settle()

    const snapshot = devtools.metrics.snapshot()
    expect(snapshot.topKeys).toEqual([{ key: 'app.hello', calls: 1 }])

    devtools.metrics.disable()
    unmount()
  })
})
