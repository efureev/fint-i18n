import { reactive } from 'vue'
import type { MessageSchema, MessageValue } from './types'

export function isMessageObject(value: unknown): value is MessageSchema {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function deepMerge(target: any, source: any): void {
  for (const key in source) {
    if (isMessageObject(source[key])) {
      if (!isMessageObject(target[key])) target[key] = {}
      deepMerge(target[key], source[key])
    }
    else {
      target[key] = source[key]
    }
  }
}

export function mergeMessageValues(target: MessageValue, source: MessageValue): MessageValue {
  if (isMessageObject(target) && isMessageObject(source)) {
    const merged = reactive({}) as MessageSchema
    deepMerge(merged, target)
    deepMerge(merged, source)
    return merged
  }

  return source
}

export function getMessageValue(messages: Record<string, any>, key: string): unknown {
  let current: unknown = messages
  let segmentStart = 0

  while (current && typeof current === 'object') {
    const separatorIndex = key.indexOf('.', segmentStart)
    const segment = separatorIndex === -1
      ? key.slice(segmentStart)
      : key.slice(segmentStart, separatorIndex)

    current = (current as Record<string, unknown>)[segment]

    if (current === undefined || separatorIndex === -1) {
      return current
    }

    segmentStart = separatorIndex + 1
  }

  return undefined
}