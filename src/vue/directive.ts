import type { Directive, DirectiveBinding } from 'vue'
import type { FintI18n } from '@/core'

export function createVTDirective(i18n: FintI18n): Directive {
  return {
    mounted(el: HTMLElement, binding: DirectiveBinding) {
      update(el, binding, i18n)
    },
    updated(el: HTMLElement, binding: DirectiveBinding) {
      if (binding.modifiers.once) return
      update(el, binding, i18n)
    }
  }
}

function update(el: HTMLElement, binding: DirectiveBinding, i18n: FintI18n) {
  const { value } = binding
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
  
  if (result === key && binding.modifiers.preserve) {
    return
  }

  el.textContent = result
}
