import { isRef } from 'vue'

export function normalizeTranslateParams(params?: Record<string, any>) {
  if (!params) return undefined

  let normalizedParams: Record<string, any> | undefined

  for (const key in params) {
    const value = params[key]
    if (!isRef(value)) continue

    if (!normalizedParams) {
      normalizedParams = { ...params }
    }

    normalizedParams[key] = value.value
  }

  return normalizedParams || params
}