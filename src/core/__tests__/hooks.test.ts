import { describe, it, expect, vi } from 'vitest'
import { HookManager } from '../hooks'

describe('HookManager', () => {
  it('should register and emit sync hooks', () => {
    const manager = new HookManager()
    const handler = vi.fn().mockImplementation((payload) => ({ ...payload, result: `${payload.result  } modified` }))

    manager.on('onTranslate', handler)
    const result = manager.emitSync('onTranslate', { key: 'test', result: 'Original' })

    expect(handler).toHaveBeenCalled()
    expect(result.result).toBe('Original modified')
  })

  it('should register and emit async hooks', async () => {
    const manager = new HookManager()
    const handler = vi.fn().mockImplementation(async (payload) => {
      return new Promise((resolve) => {
        setTimeout(resolve, 10, { ...payload, block: `${payload.block}_async` })
      })
    })

    manager.on('beforeLoadBlock', handler)
    const result = await manager.emit('beforeLoadBlock', { block: 'auth', locale: 'en' })

    expect(handler).toHaveBeenCalledWith({ block: 'auth', locale: 'en' })
    expect(result).toEqual({ block: 'auth_async', locale: 'en' })
  })

  it('should chain hooks and pass payloads', () => {
    const manager = new HookManager()
    manager.on('onTranslate', (p) => ({ ...p, result: `${p.result  }1` }))
    manager.on('onTranslate', (p) => ({ ...p, result: `${p.result  }2` }))

    const result = manager.emitSync('onTranslate', { key: 'test', result: '0' })
    expect(result.result).toBe('012')
  })

  it('should handle errors in async hooks without crashing (if handled externally)', async () => {
    const manager = new HookManager()
    manager.on('onMissingKey', async () => {
      throw new Error('Hook error')
    })

    await expect(manager.emit('onMissingKey', { key: 'test', locale: 'en' })).rejects.toThrow('Hook error')
  })

  it('should warn when async handler is used in sync hook', () => {
    const manager = new HookManager()
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    
    manager.on('onTranslate', async (p) => p)
    manager.emitSync('onTranslate', { key: 'test', result: '' })

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('received a promise from handler'))
    consoleSpy.mockRestore()
  })

  it('should unregister hooks via off and returned function', () => {
    const manager = new HookManager()
    const handler = vi.fn()

    const off = manager.on('onLocaleChange', handler)
    manager.emitSync('onLocaleChange', { locale: 'en', previous: 'ru' })
    expect(handler).toHaveBeenCalledTimes(1)

    off()
    manager.emitSync('onLocaleChange', { locale: 'ru', previous: 'en' })
    expect(handler).toHaveBeenCalledTimes(1) // Still 1

    manager.on('onLocaleChange', handler)
    manager.emitSync('onLocaleChange', { locale: 'en', previous: 'ru' })
    expect(handler).toHaveBeenCalledTimes(2)

    manager.off('onLocaleChange', handler)
    manager.emitSync('onLocaleChange', { locale: 'ru', previous: 'en' })
    expect(handler).toHaveBeenCalledTimes(2) // Still 2
  })

  it('should use a stable handler snapshot during sync emit', () => {
    const manager = new HookManager()
    const lateHandler = vi.fn(payload => ({ ...payload, result: `${payload.result}3` }))

    manager.on('onTranslate', payload => {
      manager.on('onTranslate', lateHandler)
      return { ...payload, result: `${payload.result}1` }
    })

    manager.on('onTranslate', payload => ({ ...payload, result: `${payload.result}2` }))

    const firstResult = manager.emitSync('onTranslate', { key: 'test', result: '' })
    expect(firstResult.result).toBe('12')
    expect(lateHandler).not.toHaveBeenCalled()

    const secondResult = manager.emitSync('onTranslate', { key: 'test', result: '' })
    expect(secondResult.result).toBe('123')
    expect(lateHandler).toHaveBeenCalledTimes(1)
  })

  // Одному подписчику `emitSync` не копирует массив — снимок длины даёт тот же
  // результат дешевле. Оба теста ниже держат эту эквивалентность.
  it('keeps the snapshot stable when the only handler subscribes another one', () => {
    const manager = new HookManager()
    const lateHandler = vi.fn(payload => ({ ...payload, result: `${payload.result}late` }))

    manager.on('onTranslate', (payload) => {
      manager.on('onTranslate', lateHandler)
      return { ...payload, result: `${payload.result}first` }
    })

    const result = manager.emitSync('onTranslate', { key: 'test', result: '' })

    expect(result.result).toBe('first')
    expect(lateHandler).not.toHaveBeenCalled()

    expect(manager.emitSync('onTranslate', { key: 'test', result: '' }).result).toBe('firstlate')
  })

  it('survives the only handler unsubscribing itself mid-emit', () => {
    const manager = new HookManager()
    const handler = vi.fn(payload => ({ ...payload, result: 'once' }))

    const off = manager.on('onTranslate', (payload) => {
      off()
      return handler(payload)
    })

    expect(manager.emitSync('onTranslate', { key: 'test', result: '' }).result).toBe('once')
    expect(handler).toHaveBeenCalledTimes(1)

    // Подписки не осталось — второй эмит проходит мимо.
    expect(manager.emitSync('onTranslate', { key: 'test', result: 'raw' }).result).toBe('raw')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(manager.has('onTranslate')).toBe(false)
  })
})
