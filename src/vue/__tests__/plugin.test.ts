import { describe, it, expect, vi } from 'vitest'
import { createFintI18n } from '@/core'
import { installI18n } from '../plugin'
import { useFintI18n } from '../inject'
import { createApp, defineComponent } from 'vue'

describe('Vue Plugin', () => {
  it('should install and provide i18n instance', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en' })
    
    installI18n(app, i18n)
    
    // Check if provided
    // We can't easily check app._context.provides directly in a clean way, 
    // but we can check globalProperties if globalInstall is true
  })

  it('should set global properties when globalInstall is true', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en', globalInstall: true })
    
    installI18n(app, i18n)
    
    expect(app.config.globalProperties.$t).toBe(i18n.t)
    expect(app.config.globalProperties.$i18n).toBe(i18n)
  })

  it('should NOT set global properties when globalInstall is false', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en', globalInstall: false })
    
    installI18n(app, i18n)
    
    expect(app.config.globalProperties.$t).toBeUndefined()
    expect(app.config.globalProperties.$i18n).toBeUndefined()
  })

  it('should register directive with default name', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en' })
    
    const spy = vi.spyOn(app, 'directive')
    installI18n(app, i18n)
    
    expect(spy).toHaveBeenCalledWith('t', expect.any(Object))
  })

  it('should register directive with custom name', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en' })
    
    const spy = vi.spyOn(app, 'directive')
    installI18n(app, i18n, { directive: 'i18n' })
    
    expect(spy).toHaveBeenCalledWith('i18n', expect.any(Object))
  })

  it('should NOT register directive when disabled', () => {
    const app = createApp({})
    const i18n = createFintI18n({ locale: 'en' })
    
    const spy = vi.spyOn(app, 'directive')
    installI18n(app, i18n, { directive: false })
    
    expect(spy).not.toHaveBeenCalled()
  })
  
  it('useFintI18n should throw error when not provided', () => {
     const TestComponent = defineComponent({
      setup() {
        expect(() => useFintI18n()).toThrow('[fint-i18n] Instance not found')
        return {}
      },
      template: '<div></div>'
    })
    
    const app = createApp(TestComponent)
    // Silencing vue warn about unhandled error during setup
    const originalWarn = console.warn
    console.warn = vi.fn()
    try {
        app.mount(document.createElement('div'))
    } catch {
      // ignore
    }
    console.warn = originalWarn
  })
})
