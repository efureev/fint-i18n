import { shallowRef, watchEffect, type Directive, type DirectiveBinding, type ShallowRef, type WatchStopHandle } from 'vue'
import type { FintI18n } from '../core'

export type VTDirectiveValue = string | { path: string, params?: Record<string, any> }

export interface VTDirectiveModifiers {
  once?: boolean
  preserve?: boolean
}

interface VTElementState {
  binding: ShallowRef<DirectiveBinding<VTDirectiveValue>>
  stop: WatchStopHandle
}

const elementStates = new WeakMap<HTMLElement, VTElementState>()

/**
 * Create v-t directive.
 *
 * Reactive: element text is re-rendered on locale change and when
 * lazily loaded blocks arrive (via a per-element watchEffect).
 *
 * Modifiers:
 * - `.once`: render only once, no reactivity
 * - `.preserve`: keep current text if key not found
 */
export function createVTDirective(i18n: FintI18n): Directive<HTMLElement, VTDirectiveValue> {
  return {
    mounted(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>) {
      if ((binding.modifiers as VTDirectiveModifiers).once) {
        update(el, binding, i18n)
        return
      }

      const source = shallowRef(binding)
      // t() внутри update() читает locale и реактивные messages —
      // эффект перезапустится при смене локали и доподгрузке блоков.
      const stop = watchEffect(() => update(el, source.value, i18n))
      elementStates.set(el, { binding: source, stop })
    },
    updated(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>) {
      if ((binding.modifiers as VTDirectiveModifiers).once) return

      const state = elementStates.get(el)
      if (state) {
        // Каждый ре-рендер даёт новый объект binding — присваивание триггерит эффект.
        state.binding.value = binding
      }
      else {
        update(el, binding, i18n)
      }
    },
    unmounted(el: HTMLElement) {
      const state = elementStates.get(el)
      if (state) {
        state.stop()
        elementStates.delete(el)
      }
    },
    getSSRProps(binding) {
      const parsed = parseBindingValue(binding.value)
      if (!parsed) return {}
      return { textContent: i18n.t(parsed.key, parsed.params) }
    },
  }
}

function parseBindingValue(value: VTDirectiveValue | undefined): { key: string, params?: Record<string, any> } | null {
  if (typeof value === 'string') {
    return { key: value }
  }
  if (value && typeof value === 'object') {
    return { key: value.path, params: value.params }
  }
  return null
}

function update(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>, i18n: FintI18n) {
  const parsed = parseBindingValue(binding.value)
  if (!parsed) return

  const result = i18n.t(parsed.key, parsed.params)

  if (result === parsed.key && (binding.modifiers as VTDirectiveModifiers).preserve) {
    return
  }

  el.textContent = result
}
