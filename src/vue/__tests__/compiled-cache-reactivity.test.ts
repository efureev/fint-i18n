/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createFintI18n, type FintI18n } from '../../index'
import { installI18n } from '../plugin'

/**
 * `resolve()` сначала смотрит в кэш компиляции — обычный объект, не реактивный.
 * Эффект, чей первый рендер попал в прогретый кэш, до реактивного стора не
 * доходит и потому не подписывается ни на одно сообщение; инвалидации при этом
 * недостаточно — она убирает устаревшее значение, но перезапускать ей некого.
 * Зависимостью для таких эффектов служит версия кэша.
 *
 * Второе требование к ней — точность: обычная загрузка блока перерисовывать
 * приложение не должна, поэтому версия растёт только когда из кэша действительно
 * что-то удалено.
 */

function mountWithI18n(i18n: FintI18n, key = 'common.hello') {
  const renders = { count: 0 }

  const Component = defineComponent({
    setup: () => () => {
      renders.count++
      return h('span', i18n.t(key))
    },
  })

  const wrapper = mount(Component, {
    global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
  })

  return { wrapper, renders }
}

describe('реактивность при попадании в кэш компиляции', () => {
  it('компонент, отрисованный на холодном кэше, видит перезапись', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const { wrapper } = mountWithI18n(i18n)
    expect(wrapper.text()).toBe('Hello')

    i18n.mergeMessages('en', 'common', { hello: 'edited' })
    await nextTick()

    expect(wrapper.text()).toBe('edited')
  })

  it('второй компонент на том же ключе тоже видит перезапись', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    // Первый прогревает кэш и подписывается, второй рендерит уже из кэша.
    const first = mountWithI18n(i18n).wrapper
    const second = mountWithI18n(i18n).wrapper
    expect([first.text(), second.text()]).toEqual(['Hello', 'Hello'])

    i18n.mergeMessages('en', 'common', { hello: 'edited' })
    await nextTick()

    expect(first.text()).toBe('edited')
    expect(second.text()).toBe('edited')
  })

  it('после unloadBlock и повторной загрузки компонент видит новое значение', async () => {
    let payload = 'Hello'
    const loader = vi.fn(async () => ({ hello: payload }))
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { common: loader } } })

    await i18n.loadBlock('common')
    i18n.t('common.hello')

    const { wrapper } = mountWithI18n(i18n)
    expect(wrapper.text()).toBe('Hello')

    i18n.unloadBlock('common')
    await nextTick()
    // Сообщения в сторе больше нет — на экране обязан быть сам ключ.
    expect(wrapper.text()).toBe('common.hello')

    payload = 'edited'
    await i18n.loadBlock('common')
    await nextTick()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toBe('edited')
  })

  it('te() на прогретом кэше тоже перестаёт врать после выгрузки', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.t('common.hello')

    const Probe = defineComponent({
      setup: () => () => h('span', String(i18n.te('common.hello'))),
    })
    const wrapper = mount(Probe, {
      global: { plugins: [{ install: (app: any) => installI18n(app, i18n) }] },
    })
    expect(wrapper.text()).toBe('true')

    i18n.unloadBlock('common')
    await nextTick()

    expect(wrapper.text()).toBe('false')
  })

  it('вторая подряд инвалидация тоже доходит — после промаха эффект не теряет подписку', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.t('common.hello')

    const { wrapper, renders } = mountWithI18n(i18n)
    const before = renders.count

    // Пустой merge данных не меняет, но кэш компиляции чистит: следующий рендер
    // придётся на промах. Версия читается и там, поэтому подписка сохраняется.
    i18n.mergeMessages('en', 'common', {})
    await nextTick()
    expect(renders.count).toBe(before + 1)

    i18n.mergeMessages('en', 'common', { hello: 'edited' })
    await nextTick()
    expect(wrapper.text()).toBe('edited')
  })

  it('загрузка постороннего блока не перерисовывает то, чего она не касается', async () => {
    const i18n = createFintI18n({
      locale: 'en',
      loaders: { en: { other: async () => ({ k: 'v' }) } },
    })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })

    const { renders } = mountWithI18n(i18n)
    const before = renders.count

    await i18n.loadBlock('other')
    await nextTick()

    expect(renders.count).toBe(before)
  })

  it('повторный merge блока, из которого ничего не компилировалось, не трогает чужие рендеры', async () => {
    const i18n = createFintI18n({ locale: 'en' })
    i18n.mergeMessages('en', 'common', { hello: 'Hello' })
    i18n.mergeMessages('en', 'other', { k: 'v' })

    const { renders } = mountWithI18n(i18n)
    const before = renders.count

    i18n.mergeMessages('en', 'other', { k: 'v2' })
    await nextTick()

    expect(renders.count).toBe(before)
  })
})
