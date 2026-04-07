import type { Directive, DirectiveBinding } from 'vue'
import type { FintI18n } from '@/core'

export type VTDirectiveValue = string | { path: string, params?: Record<string, any> }

export interface VTDirectiveModifiers {
  once?: boolean
  preserve?: boolean
}

/**
 * Create v-t directive.
 * 
 * Modifiers:
 * - `.once`: render only once
 * - `.preserve`: keep current text if key not found
 */
export function createVTDirective(i18n: FintI18n): Directive<HTMLElement, VTDirectiveValue> {
  return {
    mounted(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>) {
      update(el, binding, i18n)
    },
    updated(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>) {
      if ((binding.modifiers as VTDirectiveModifiers).once) return
      update(el, binding, i18n)
    }
  }
}

function update(el: HTMLElement, binding: DirectiveBinding<VTDirectiveValue>, i18n: FintI18n) {
  const { value, modifiers } = binding
  let key: string
  let params: Record<string, any> | undefined

  if (typeof value === 'string') {
    key = value
  } else if (value && typeof value === 'object') {
    key = value.path
    params = value.params
  } else {
    return
  }

  const result = i18n.t(key, params)
  
  if (result === key && (modifiers as VTDirectiveModifiers).preserve) {
    return
  }

  el.textContent = result
}
