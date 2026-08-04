<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { locale } = i18n

/** Локаль, на которую идёт переход: у неё грузятся блоки, и это может занять время. */
const pending = ref<string | null>(null)

// Состав берётся из инстанса, а не из списка в компоненте: добавили локаль
// в лоадеры — она сама появилась в переключателе.
const locales = computed(() => i18n.getAvailableLocales().map((code) => {
  // Каждый язык подписан на самом себе — так подпись читается тем, кто
  // ищет свой язык и не читает текущий.
  const display = new Intl.DisplayNames([code], { type: 'language' })

  return { code, label: code.toUpperCase(), native: display.of(code) ?? code }
}))

async function select(code: string) {
  if (code === locale.value || pending.value) return

  pending.value = code
  try {
    await i18n.setLocale(code)
  }
  finally {
    pending.value = null
  }
}
</script>

<template>
  <div
    role="group"
    :aria-label="i18n.t('ui.header.localeSwitcher')"
    class="inline-flex items-center gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-slate-200 shadow-sm shadow-slate-900/5"
  >
    <button
      v-for="item in locales"
      :key="item.code"
      type="button"
      :data-test="`locale-${item.code}`"
      :title="item.native"
      :aria-pressed="item.code === locale"
      :disabled="pending !== null"
      class="relative rounded-lg px-3 py-1.5 text-sm font-semibold tracking-wide transition disabled:cursor-default"
      :class="item.code === locale
        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/25'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'"
      @click="select(item.code)"
    >
      {{ item.label }}
      <span
        v-if="pending === item.code"
        class="i-lucide-loader-2 animate-spin absolute -right-0.5 -top-0.5 h-3 w-3 text-indigo-500"
      />
    </button>
  </div>
</template>
