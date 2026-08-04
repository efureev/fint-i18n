import { describe, expect, it, vi } from 'vitest'
import { createFintI18n } from '../instance'

/** Лоадер, падающий первые `failures` раз. */
function flakyLoader(failures: number, value: Record<string, string> = { k: 'v' }) {
  let calls = 0
  const loader = vi.fn(async () => {
    calls++
    if (calls <= failures) throw new Error(`boom ${calls}`)
    return value
  })
  return loader
}

const noBackoff = () => 0

describe('retry: off by default', () => {
  it('makes a single attempt when the option is absent', async () => {
    const loader = flakyLoader(1)
    const i18n = createFintI18n({ locale: 'en', loaders: { en: { a: loader } } })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom 1')
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('retry: repeated attempts', () => {
  it('recovers on the second attempt', async () => {
    const loader = flakyLoader(1)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await i18n.loadBlock('a')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('a.k')).toBe('v')
    expect(i18n.isBlockLoaded('a')).toBe(true)
  })

  it('defaults to three attempts', async () => {
    const loader = flakyLoader(5)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom 3')
    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('honours an explicit attempt count', async () => {
    const loader = flakyLoader(10)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 5, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom 5')
    expect(loader).toHaveBeenCalledTimes(5)
  })

  it('treats attempts below one as a single attempt', async () => {
    const loader = flakyLoader(1)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 0, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom 1')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('reports the last error, not the first', async () => {
    const loader = flakyLoader(3)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 2, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow('boom 2')
  })
})

describe('retry: backoff', () => {
  it('asks for a delay before every attempt but the first', async () => {
    const backoff = vi.fn((_attempt: number) => 0)
    const loader = flakyLoader(2)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 3, backoff },
      loaders: { en: { a: loader } },
    })

    await i18n.loadBlock('a')

    expect(backoff.mock.calls.map(c => c[0])).toEqual([1, 2])
  })

  it('does not wait after the final failure', async () => {
    const backoff = vi.fn(() => 0)
    const loader = flakyLoader(10)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 2, backoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow()
    expect(backoff).toHaveBeenCalledTimes(1)
  })

  it('actually waits the requested time', async () => {
    const loader = flakyLoader(1)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { backoff: () => 40 },
      loaders: { en: { a: loader } },
    })

    const started = Date.now()
    await i18n.loadBlock('a')

    expect(Date.now() - started).toBeGreaterThanOrEqual(30)
  })
})

describe('retry: timeout', () => {
  it('gives up on a hanging attempt and retries', async () => {
    let calls = 0
    const loader = vi.fn(async () => {
      calls++
      if (calls === 1) return new Promise<Record<string, string>>(() => {}) // навсегда
      return { k: 'v' }
    })

    const i18n = createFintI18n({
      locale: 'en',
      retry: { timeout: 20, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await i18n.loadBlock('a')

    expect(loader).toHaveBeenCalledTimes(2)
    expect(i18n.t('a.k')).toBe('v')
  })

  it('surfaces the timeout when every attempt hangs', async () => {
    const loader = vi.fn(async () => new Promise<Record<string, string>>(() => {}))
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 2, timeout: 20, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow('timed out after 20ms')
  })

  it('does not fire when the loader is fast enough', async () => {
    const loader = vi.fn(async () => ({ k: 'v' }))
    const i18n = createFintI18n({
      locale: 'en',
      retry: { timeout: 1000 },
      loaders: { en: { a: loader } },
    })

    await i18n.loadBlock('a')

    expect(i18n.t('a.k')).toBe('v')
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('retry: interaction with the rest of the runtime', () => {
  it('keeps deduplicating while it retries', async () => {
    const loader = flakyLoader(1)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { backoff: () => 10 },
      loaders: { en: { a: loader } },
    })

    // Три конкурентных вызова во время повторов обязаны разделить один промис.
    await Promise.all([i18n.loadBlock('a'), i18n.loadBlock('a'), i18n.loadBlock('a')])

    expect(loader).toHaveBeenCalledTimes(2) // одна неудача + один успех, не три серии
    expect(i18n.t('a.k')).toBe('v')
  })

  it('retries each loader of a block independently', async () => {
    const first = vi.fn(async () => ({ a: 'first' }))
    const second = flakyLoader(1, { b: 'second' })

    const i18n = createFintI18n({
      locale: 'en',
      retry: { backoff: noBackoff },
      loaders: { en: { block: [first, second] } },
    })

    await i18n.loadBlock('block')

    // Успешный лоадер не переигрывается из-за отказа соседнего.
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    expect(i18n.t('block.a')).toBe('first')
    expect(i18n.t('block.b')).toBe('second')
  })

  it('stops retrying once the instance is disposed', async () => {
    const loader = flakyLoader(10)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 5, backoff: () => 20 },
      loaders: { en: { a: loader } },
    })

    const load = i18n.loadBlock('a')
    await new Promise(resolve => setTimeout(resolve, 10))
    i18n.dispose()
    await load.catch(() => {})

    const afterDispose = loader.mock.calls.length
    await new Promise(resolve => setTimeout(resolve, 60))

    expect(loader.mock.calls.length).toBe(afterDispose)
    expect(afterDispose).toBeLessThan(5)
  })

  it('reports the failure through onError when used via loadUsedBlocks', async () => {
    const loader = flakyLoader(10)
    const errors: unknown[] = []

    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 2, backoff: noBackoff },
      loaders: { en: { a: loader }, ru: { a: loader } },
    })
    i18n.hooks.on('onError', ({ error }) => { errors.push(error) })

    i18n.registerUsage('a')
    await i18n.loadUsedBlocks('ru')

    // Хук получает только итоговый отказ, а не каждую попытку.
    expect(errors).toHaveLength(1)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('lets a later manual load succeed after retries were exhausted', async () => {
    const loader = flakyLoader(2)
    const i18n = createFintI18n({
      locale: 'en',
      retry: { attempts: 2, backoff: noBackoff },
      loaders: { en: { a: loader } },
    })

    await expect(i18n.loadBlock('a')).rejects.toThrow()
    await i18n.loadBlock('a')

    expect(i18n.t('a.k')).toBe('v')
  })
})
