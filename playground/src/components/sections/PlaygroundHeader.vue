<script setup lang="ts">
import { computed } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t, locale } = i18n

const localeBadge = computed(() => locale.value.toUpperCase())

const toggleLocale = async () => {
  await i18n.setLocale(locale.value === 'en' ? 'ru' : 'en')
}
</script>

<template>
  <header class="bg-slate-950 text-white px-6 py-6 md:px-8">
    <div class="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl">
        <p class="text-xs uppercase tracking-[0.32em] text-slate-400 mb-3">
          {{ t('ui.header.eyebrow') }}
        </p>
        <h1 class="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <span class="i-lucide-languages text-indigo-300" />
          {{ t('ui.header.title') }}
        </h1>
        <p class="text-sm md:text-base text-slate-300 mt-3 leading-6">
          {{ t('ui.header.description') }}
        </p>
      </div>

      <div class="flex flex-col gap-3 md:items-end">
        <div class="inline-flex items-center gap-2 rounded-full bg-white/8 border border-white/10 px-3 py-1.5 text-xs text-slate-300">
          <span class="i-lucide-badge-info text-indigo-300" />
          {{ t('ui.header.localeBadge') }}
          <span class="rounded-full bg-indigo-500/20 px-2 py-0.5 text-indigo-200 font-semibold">{{ localeBadge }}</span>
        </div>

        <button
          data-test="toggle-locale"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 transition font-medium border border-indigo-300/20 shadow-lg shadow-indigo-950/25"
          type="button"
          @click="toggleLocale"
        >
          <span class="i-lucide-repeat" />
          {{ t('common.changeLang') }}
        </button>

        <p class="text-xs text-slate-400 max-w-xs md:text-right">
          {{ t('ui.header.toggleHint') }}
        </p>
      </div>
    </div>
  </header>
</template>
