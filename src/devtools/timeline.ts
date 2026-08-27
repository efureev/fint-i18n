import type { DevtoolsEvent, DevtoolsEventType } from './types'

const DEFAULT_LIMIT = 200

export interface Timeline {
  readonly events: readonly DevtoolsEvent[]
  push: (type: DevtoolsEventType, payload?: unknown) => DevtoolsEvent
  subscribe: (listener: (event: DevtoolsEvent) => void) => () => void
  clear: () => void
}

/**
 * Кольцевой буфер: панель живёт долго, а событий у активного приложения много,
 * поэтому лента ограничена сверху и старое вытесняется.
 */
export function createTimeline(limit = DEFAULT_LIMIT): Timeline {
  const max = Math.max(1, limit)
  let events: DevtoolsEvent[] = []
  const listeners: ((event: DevtoolsEvent) => void)[] = []
  let nextId = 0

  return {
    get events() {
      return events
    },

    push(type, payload) {
      const event: DevtoolsEvent = { id: ++nextId, at: Date.now(), type, payload }

      events.push(event)
      if (events.length > max) events.splice(0, events.length - max)

      // Копия на время обхода: подписчик вправе отписаться прямо из обработчика.
      for (const listener of listeners.slice()) listener(event)

      return event
    },

    subscribe(listener) {
      listeners.push(listener)
      return () => {
        const index = listeners.indexOf(listener)
        if (index !== -1) listeners.splice(index, 1)
      }
    },

    clear() {
      events = []
    },
  }
}
