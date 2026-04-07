import { onUnmounted } from 'vue'
import { useFintI18n } from './inject'

export async function useI18nScope(blocks: string | string[]) {
  const i18n = useFintI18n()
  const normalizedBlocks = Array.isArray(blocks) ? blocks : [blocks]

  onUnmounted(() => {
    normalizedBlocks.forEach(block => i18n.unregisterUsage(block))
  })

  const loads = normalizedBlocks.map(block => {
    i18n.registerUsage(block)
    return i18n.loadBlock(block)
  })

  await Promise.all(loads)

  return {
    t: (key: string, params?: Record<string, any>) => i18n.t(key, params),
    locale: i18n.locale,
    setLocale: (l: string) => i18n.setLocale(l),
  }
}
