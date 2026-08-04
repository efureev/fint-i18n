import type { FintI18n } from '../core'
import type { I18nFormatters } from '../core/format'
import { createFormatters } from '../core/format'
import { useFintI18n } from './inject'

// Форматтеры не хранят состояния сверх ссылки на инстанс, поэтому один набор
// переиспользуется всеми компонентами: вызов в каждом из тысячи компонентов
// не должен создавать тысячу замыканий.
const formattersByInstance = new WeakMap<FintI18n, I18nFormatters>()

/**
 * Локаль читается в момент вызова, поэтому результат реактивен: в шаблоне
 * и в `computed` он пересчитывается после `setLocale()`.
 *
 * ```vue
 * <script setup lang="ts">
 * const { n, d } = useI18nFormat()
 * </script>
 *
 * <template>
 *   <span>{{ n(price, { style: 'currency', currency: 'EUR' }) }}</span>
 *   <time>{{ d(createdAt, { dateStyle: 'long' }) }}</time>
 * </template>
 * ```
 */
export function useI18nFormat(): I18nFormatters {
  const i18n = useFintI18n()

  let formatters = formattersByInstance.get(i18n)
  if (!formatters) {
    formatters = createFormatters(() => i18n.locale.value)
    formattersByInstance.set(i18n, formatters)
  }

  return formatters
}
