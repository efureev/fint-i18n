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
        setTimeout(resolve, 10, `${payload  }_async`)
      })
    })

    manager.on('beforeLoadBlock', handler)
    const result = await manager.emit('beforeLoadBlock', 'auth')

    expect(handler).toHaveBeenCalledWith('auth')
    expect(result).toBe('auth_async')
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
})
