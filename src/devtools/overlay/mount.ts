import { createApp } from 'vue'
import type { FintI18nDevtools, OverlayOptions } from '../types'
import DevtoolsOverlay from './DevtoolsOverlay.vue'
import { OVERLAY_STYLES } from './styles'

const HOST_ID = 'fint-i18n-devtools'
const DEFAULT_HOTKEY = 'alt+i'

interface Hotkey {
  alt: boolean
  ctrl: boolean
  shift: boolean
  meta: boolean
  key: string
}

function parseHotkey(hotkey: string): Hotkey {
  const parts = hotkey.toLowerCase().split('+').map(part => part.trim())

  return {
    alt: parts.includes('alt'),
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta') || parts.includes('cmd'),
    key: parts[parts.length - 1],
  }
}

/**
 * Панель живёт в собственном Vue-приложении и в Shadow DOM, а не в дереве
 * хозяина. Причин две, и обе неустранимы иначе: в дереве хозяина панель попала
 * бы в его же Vue Devtools и в его счётчики `useI18nScope`, а без теневого
 * корня её разнесли бы стили приложения — в чужом проекте они любые.
 */
export function mountOverlay(devtools: FintI18nDevtools, options: OverlayOptions = {}): () => void {
  if (typeof document === 'undefined') return () => {}

  const host = document.createElement('div')
  host.id = HOST_ID
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES
  shadow.appendChild(style)

  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  const app = createApp(DevtoolsOverlay, {
    devtools,
    position: options.position ?? 'bottom-right',
    collapsed: options.collapsed ?? false,
    storage: options.storage,
  })

  const instance = app.mount(mountPoint) as unknown as { toggle: () => void }

  let onKeydown: ((event: KeyboardEvent) => void) | undefined

  if (options.hotkey !== false) {
    const combo = parseHotkey(options.hotkey ?? DEFAULT_HOTKEY)

    onKeydown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== combo.key) return
      if (event.altKey !== combo.alt || event.ctrlKey !== combo.ctrl) return
      if (event.shiftKey !== combo.shift || event.metaKey !== combo.meta) return

      event.preventDefault()
      instance.toggle()
    }

    window.addEventListener('keydown', onKeydown)
  }

  return () => {
    if (onKeydown) window.removeEventListener('keydown', onKeydown)
    app.unmount()
    host.remove()
  }
}
