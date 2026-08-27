/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createFintI18n } from '../../core'
import { BRIDGE_KEY, createDevtools, mountDevtoolsOverlay } from '../index'
import {
  SNAP_MARGIN,
  anchorFrom,
  clampPosition,
  clampSize,
  readLayout,
  toPosition,
  willSnap,
  writeLayout,
} from '../overlay/layout'

const HOST_ID = 'fint-i18n-devtools'
const KEY = 'fint-i18n-devtools:layout'
const VIEWPORT = { width: 1000, height: 800 }

/** Хранилище подсовывается фейком: `localStorage` в этом окружении отсутствует. */
function fakeStorage(initial?: Record<string, string>) {
  const data = new Map(Object.entries(initial ?? {}))
  const spies = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value) }),
    removeItem: vi.fn((key: string) => { data.delete(key) }),
  }

  return { spies, storage: { ...spies, clear: () => data.clear(), key: () => null, length: 0 } as unknown as Storage }
}

const shadow = () => document.getElementById(HOST_ID)!.shadowRoot!
const el = (selector: string) => shadow().querySelector(selector) as HTMLElement
const stored = (spies: { getItem: (key: string) => string | null }) => JSON.parse(spies.getItem(KEY) as string)

async function settle() {
  await Promise.resolve()
  await nextTick()
  await nextTick()
}

function pointer(type: string, x: number, y: number, target: EventTarget) {
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true }))
}

function resizeWindow(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
  window.dispatchEvent(new Event('resize'))
}

async function mountPanel(storage: Storage | false) {
  const devtools = createDevtools()
  const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })
  const unmount = await mountDevtoolsOverlay(devtools, { storage, locale: 'en' })
  await settle()

  return { devtools, i18n, unmount }
}

afterEach(() => {
  document.getElementById(HOST_ID)?.remove()
  delete (window as any)[BRIDGE_KEY]
  resizeWindow(1024, 768)
})

describe('координаты и края', () => {
  const size = { w: 400, h: 300 }

  it('не выпускает панель за окно целиком, а не «оставляя уголок»', () => {
    expect(clampPosition(5000, 5000, size, VIEWPORT)).toEqual({ x: 600, y: 500 })
    expect(clampPosition(-100, -100, size, VIEWPORT)).toEqual({ x: 0, y: 0 })
  })

  it('на экране меньше панели прижимает к началу координат', () => {
    expect(clampPosition(10, 10, { w: 2000, h: 2000 }, VIEWPORT)).toEqual({ x: 0, y: 0 })
  })

  it('привязывается к ближнему краю по каждой оси', () => {
    expect(anchorFrom(50, 400, size, VIEWPORT)).toMatchObject({ edgeX: 'left', edgeY: 'bottom' })
    expect(anchorFrom(550, 50, size, VIEWPORT)).toMatchObject({ edgeX: 'right', edgeY: 'top' })
  })

  it('в пределах порога отступ схлопывается к полю — это и есть прилипание', () => {
    expect(anchorFrom(8, 400, size, VIEWPORT).dx).toBe(SNAP_MARGIN)
    // Дальше порога отступ сохраняется как есть.
    expect(anchorFrom(200, 400, size, VIEWPORT).dx).toBe(200)
  })

  it('подсказывает о прилипании только вблизи края', () => {
    expect(willSnap(8, 400, size, VIEWPORT)).toBe(true)
    expect(willSnap(300, 300, size, VIEWPORT)).toBe(false)
  })

  it('привязка к правому краю пересчитывается от ширины окна', () => {
    const anchor = { edgeX: 'right' as const, edgeY: 'top' as const, dx: 16, dy: 16 }

    expect(toPosition(anchor, size, VIEWPORT)).toEqual({ x: 584, y: 16 })
    // Окно уже — панель едет за краем, а не остаётся на месте.
    expect(toPosition(anchor, size, { width: 800, height: 800 })).toEqual({ x: 384, y: 16 })
  })

  it('размер не превышает окно: запись могла приехать с монитора побольше', () => {
    expect(clampSize({ w: 5000, h: 5000 }, VIEWPORT)).toEqual({ w: 984, h: 784 })
  })
})

describe('чтение и запись положения', () => {
  it('битую запись не применяет и удаляет', () => {
    const { storage, spies } = fakeStorage({ [KEY]: '{ not json' })

    expect(readLayout(storage)).toBeNull()
    expect(spies.removeItem).toHaveBeenCalledWith(KEY)
  })

  it('неизвестный край делает запись негодной целиком', () => {
    const { storage, spies } = fakeStorage({
      [KEY]: JSON.stringify({ anchor: { edgeX: 'middle', edgeY: 'top', dx: 1, dy: 1 } }),
    })

    expect(readLayout(storage)).toBeNull()
    expect(spies.removeItem).toHaveBeenCalledWith(KEY)
  })

  it('дописывает поля, а не заменяет запись целиком', () => {
    const { storage } = fakeStorage()

    writeLayout(storage, { anchor: { edgeX: 'left', edgeY: 'top', dx: 10, dy: 20 } })
    writeLayout(storage, { size: { w: 700, h: 500 } })

    expect(readLayout(storage)).toEqual({
      anchor: { edgeX: 'left', edgeY: 'top', dx: 10, dy: 20 },
      size: { w: 700, h: 500 },
    })
  })

  it('переживает хранилище, которое бросает на запись', () => {
    const { storage, spies } = fakeStorage()
    spies.setItem.mockImplementation(() => { throw new Error('QuotaExceeded') })

    expect(() => writeLayout(storage, { size: { w: 1, h: 2 } })).not.toThrow()
  })
})

describe('панель: перетаскивание', () => {
  it('едет за шапкой и запоминает привязку', async () => {
    const { storage, spies } = fakeStorage()
    const { unmount } = await mountPanel(storage)

    pointer('pointerdown', 20, 20, el('.head'))
    pointer('pointermove', 320, 280, window)
    pointer('pointerup', 320, 280, window)
    await settle()

    expect(el('.root').style.left).toBe('300px')
    expect(stored(spies).anchor).toMatchObject({ edgeX: 'left', edgeY: 'top', dx: 300, dy: 260 })

    unmount()
  })

  it('вблизи края прилипает к нему', async () => {
    const { storage, spies } = fakeStorage()
    const { unmount } = await mountPanel(storage)

    pointer('pointerdown', 100, 100, el('.head'))
    pointer('pointermove', 108, 460, window)
    pointer('pointerup', 108, 460, window)
    await settle()

    // 8px от левого края — прилипло на SNAP_MARGIN.
    expect(stored(spies).anchor.dx).toBe(SNAP_MARGIN)
    expect(el('.root').style.left).toBe(`${SNAP_MARGIN}px`)

    unmount()
  })

  it('за кнопку в шапке не тащится', async () => {
    const { storage, spies } = fakeStorage()
    const { unmount } = await mountPanel(storage)

    pointer('pointerdown', 20, 20, shadow().querySelector('.head button') as HTMLElement)
    pointer('pointermove', 300, 300, window)
    pointer('pointerup', 300, 300, window)
    await settle()

    expect(el('.root').style.left).toBe('')
    expect(spies.setItem).not.toHaveBeenCalled()

    unmount()
  })

  it('не выпускает панель за пределы окна', async () => {
    const { storage } = fakeStorage()
    const { unmount } = await mountPanel(storage)

    pointer('pointerdown', 10, 10, el('.head'))
    pointer('pointermove', -500, -500, window)
    pointer('pointerup', -500, -500, window)
    await settle()

    expect(el('.root').style.left).toBe(`${SNAP_MARGIN}px`)
    expect(el('.root').style.top).toBe(`${SNAP_MARGIN}px`)

    unmount()
  })
})

describe('панель: восстановление, край и сброс', () => {
  it('применяет сохранённую привязку и размер при открытии', async () => {
    const { storage } = fakeStorage({
      [KEY]: JSON.stringify({
        anchor: { edgeX: 'left', edgeY: 'top', dx: 40, dy: 50 },
        size: { w: 700, h: 400 },
      }),
    })
    const { unmount } = await mountPanel(storage)

    expect(el('.root').style.left).toBe('40px')
    expect(el('.root').style.top).toBe('50px')
    expect(el('.panel').style.width).toBe('700px')

    unmount()
  })

  it('идёт за краем окна, когда тот двигается', async () => {
    const { storage } = fakeStorage({
      [KEY]: JSON.stringify({ anchor: { edgeX: 'right', edgeY: 'top', dx: 16, dy: 16 } }),
    })
    const { unmount } = await mountPanel(storage)

    resizeWindow(1000, 800)
    await settle()
    const wide = Number.parseFloat(el('.root').style.left)

    resizeWindow(700, 800)
    await settle()
    const narrow = Number.parseFloat(el('.root').style.left)

    expect(wide - narrow).toBe(300)

    unmount()
  })

  it('уменьшение окна не оставляет панель за экраном', async () => {
    const { storage } = fakeStorage({
      [KEY]: JSON.stringify({ anchor: { edgeX: 'left', edgeY: 'top', dx: 900, dy: 700 } }),
    })
    const { unmount } = await mountPanel(storage)

    resizeWindow(400, 300)
    await settle()

    expect(Number.parseFloat(el('.root').style.left)).toBeLessThanOrEqual(400)
    expect(Number.parseFloat(el('.root').style.top)).toBeLessThanOrEqual(300)

    unmount()
  })

  it('двойной клик по шапке возвращает панель в угол и стирает запись', async () => {
    const { storage, spies } = fakeStorage({
      [KEY]: JSON.stringify({ anchor: { edgeX: 'left', edgeY: 'top', dx: 40, dy: 50 } }),
    })
    const { unmount } = await mountPanel(storage)
    expect(el('.root').style.left).toBe('40px')

    el('.head').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await settle()

    expect(el('.root').style.left).toBe('')
    expect(el('.root').className).toContain('bottom-right')
    expect(spies.removeItem).toHaveBeenCalledWith(KEY)

    unmount()
  })

  it('storage: false отключает и чтение, и запись', async () => {
    const { unmount } = await mountPanel(false)

    pointer('pointerdown', 20, 20, el('.head'))
    pointer('pointermove', 320, 280, window)
    pointer('pointerup', 320, 280, window)
    await settle()

    // Панель двигается, но ничего не запоминает.
    expect(el('.root').style.left).toBe('300px')

    unmount()
  })
})

describe('панель: обрезка словаря', () => {
  it('показывает полное число ключей, когда список обрезан', async () => {
    const devtools = createDevtools()
    const i18n = createFintI18n({ locale: 'en', plugins: [devtools] })

    const messages: Record<string, string> = {}
    for (let i = 0; i < 1200; i++) messages[`key${i}`] = `value ${i}`
    i18n.mergeMessages('en', 'big', messages)

    const unmount = await mountDevtoolsOverlay(devtools, { storage: false, locale: 'en' })
    await settle()

    const tab = [...shadow().querySelectorAll('.tabs button')]
      .find(button => button.textContent?.startsWith('dictionary')) as HTMLElement
    tab.click()
    await settle()

    expect(shadow().textContent).toContain('showing 1000 of 1200')

    unmount()
  })
})
