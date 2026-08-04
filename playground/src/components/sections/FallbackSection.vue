<script setup lang="ts">
import { onMounted } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const i18n = useFintI18n()
const { t, locale } = i18n

// Load the `fallback` block for BOTH locales so the fallback chain has
// something to resolve against regardless of the active locale.
onMounted(() => {
  void i18n.loadBlock('fallback', 'en')
  void i18n.loadBlock('fallback', 'ru')
})

// Pinning the fallback to the current locale disables cross-locale fallback,
// so this shows the "raw" resolution (returns the key when missing).
const raw = (key: string) => t(key, {}, { fallbackLocale: locale.value })
const isMissing = (key: string) => raw(key) === key
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.fallback.eyebrow')"
    :title="t('ui.sections.fallback.title')"
    :description="t('ui.sections.fallback.description')"
  >
    <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200">
      <div class="grid grid-cols-3 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        <div class="px-3 py-2">
          {{ t('ui.sections.fallback.keyColumn') }}
        </div>
        <div class="px-3 py-2">
          {{ t('ui.sections.fallback.currentColumn') }}
        </div>
        <div class="px-3 py-2">
          {{ t('ui.sections.fallback.fallbackColumn') }}
        </div>
      </div>

      <!-- Instance fallbackLocale: EN-only key resolves when active locale is RU -->
      <div class="grid grid-cols-3 border-t border-slate-200 text-sm">
        <div class="px-3 py-3 font-mono text-xs text-slate-700">
          fallback.enOnly
        </div>
        <div class="px-3 py-3" :class="isMissing('fallback.enOnly') ? 'text-slate-400 italic' : 'text-slate-800'">
          {{ isMissing('fallback.enOnly') ? t('ui.sections.fallback.missing') : raw('fallback.enOnly') }}
        </div>
        <div class="px-3 py-3 text-emerald-700 font-medium">
          {{ t('fallback.enOnly') }}
        </div>
      </div>

      <!-- Per-call TranslateOptions: RU-only key resolves via { fallbackLocale: 'ru' } -->
      <div class="grid grid-cols-3 border-t border-slate-200 text-sm">
        <div class="px-3 py-3 font-mono text-xs text-slate-700">
          fallback.ruOnly
        </div>
        <div class="px-3 py-3" :class="isMissing('fallback.ruOnly') ? 'text-slate-400 italic' : 'text-slate-800'">
          {{ isMissing('fallback.ruOnly') ? t('ui.sections.fallback.missing') : raw('fallback.ruOnly') }}
        </div>
        <div class="px-3 py-3 text-emerald-700 font-medium">
          {{ t('fallback.ruOnly', {}, { fallbackLocale: 'ru' }) }}
        </div>
      </div>
    </div>

    <div class="mt-4 grid gap-2 text-xs text-slate-500 md:grid-cols-2">
      <p class="flex items-start gap-2">
        <span class="i-lucide-corner-down-right mt-0.5 text-emerald-500" />
        {{ t('ui.sections.fallback.instanceNote') }}
      </p>
      <p class="flex items-start gap-2">
        <span class="i-lucide-corner-down-right mt-0.5 text-emerald-500" />
        {{ t('ui.sections.fallback.perCallNote') }}
      </p>
    </div>
  </PlaygroundSection>
</template>
