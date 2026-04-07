import { onScopeDispose, shallowRef } from 'vue'
import type { FintI18n } from '@feugene/fint-i18n/core'

type HookEventName = 'onLocaleChange' | 'beforeLoadBlock' | 'afterLoadBlock' | 'onMissingKey'

interface HookEventEntry {
  id: number
  name: HookEventName
  timestamp: string
  data: unknown
}

interface HookFeedOptions {
  limit?: number
}

const DEFAULT_LIMIT = 20

const cloneHookPayload = (payload: unknown): unknown => {
  if (payload == null) {
    return null
  }

  if (typeof structuredClone === 'function') {
    return structuredClone(payload)
  }

  try {
    return JSON.parse(JSON.stringify(payload))
  }
  catch {
    return payload
  }
}

export function usePlaygroundHooksFeed(i18n: FintI18n, options: HookFeedOptions = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT
  const events = shallowRef<HookEventEntry[]>([])
  let nextId = 0
  let flushScheduled = false
  const pendingEvents: HookEventEntry[] = []

  const scheduleFlush = () => {
    if (flushScheduled) {
      return
    }

    flushScheduled = true

    queueMicrotask(() => {
      flushScheduled = false

      if (pendingEvents.length === 0) {
        return
      }

      const nextBatch = pendingEvents.splice(0, pendingEvents.length)
      events.value = [...nextBatch.reverse(), ...events.value].slice(0, limit)
    })
  }

  const appendEvent = (name: HookEventName, data?: unknown) => {
    const nextEvent: HookEventEntry = {
      id: ++nextId,
      name,
      timestamp: new Date().toLocaleTimeString(),
      data: cloneHookPayload(data),
    }

    pendingEvents.push(nextEvent)
    scheduleFlush()
  }

  const disposers = [
    i18n.hooks.on('onLocaleChange', data => appendEvent('onLocaleChange', data)),
    i18n.hooks.on('beforeLoadBlock', data => appendEvent('beforeLoadBlock', data)),
    i18n.hooks.on('afterLoadBlock', data => appendEvent('afterLoadBlock', data)),
    i18n.hooks.on('onMissingKey', data => appendEvent('onMissingKey', data)),
  ]

  const clear = () => {
    events.value = []
  }

  onScopeDispose(() => {
    for (const dispose of disposers) {
      dispose()
    }
  })

  return {
    events,
    clear,
  }
}