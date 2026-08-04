<script setup lang="ts">
import { useFintI18n, useI18nScopeSync } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const { t } = useFintI18n()

// Synchronous scope — no <Suspense> needed. The `profile` block streams in the
// background; `ready` flips to true when it lands. `prefix: true` lets us call
// keys relative to the block: scope.t('title') → profile.title.
const scope = useI18nScopeSync(['profile'], { prefix: true })
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.scopeSync.eyebrow')"
    :title="t('ui.sections.scopeSync.title')"
    :description="t('ui.sections.scopeSync.description')"
  >
    <template #aside>
      <div
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
        :class="scope.ready.value
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-slate-50 text-slate-500'"
      >
        <span :class="scope.ready.value ? 'i-lucide-check-circle-2' : 'i-lucide-loader-2 animate-spin'" />
        {{ scope.ready.value ? t('ui.sections.scopeSync.readyBadge') : t('ui.sections.scopeSync.loadingBadge') }}
      </div>
    </template>

    <div class="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <h3 class="text-lg font-semibold text-slate-900">
        {{ scope.t('title') }}
      </h3>
      <p class="mt-1 text-sm text-indigo-700 font-medium">
        {{ scope.t('subtitle') }}
      </p>
      <p class="mt-2 text-sm text-slate-600 leading-6">
        {{ scope.t('hint') }}
      </p>
    </div>

    <p class="mt-3 text-xs text-slate-500 flex items-start gap-2">
      <span class="i-lucide-info mt-0.5 text-indigo-400" />
      {{ t('ui.sections.scopeSync.prefixNote') }}
    </p>
  </PlaygroundSection>
</template>
