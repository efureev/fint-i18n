<script setup lang="ts">
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t } = useFintI18n()
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.directive.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.directive.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.directive.description') }}
      </p>
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-2">
      <div class="rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <span class="text-xs text-blue-700 font-bold block mb-2 uppercase tracking-wide">{{ t('ui.sections.directive.normalLabel') }}</span>
        <span v-t="'common.changeLang'" class="text-blue-900 font-medium" />
      </div>

      <div class="rounded-2xl border border-amber-100 bg-amber-50 p-4">
        <span class="text-xs text-amber-700 font-bold block mb-2 uppercase tracking-wide">{{ t('ui.sections.directive.onceLabel') }}</span>
        <span v-t.once="'common.changeLang'" class="text-amber-900 font-medium" />
        <p class="text-[11px] text-amber-700/80 mt-2 leading-5">
          {{ t('ui.sections.directive.onceHint') }}
        </p>
      </div>
    </div>
  </section>
</template>
