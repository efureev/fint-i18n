<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n, useI18nFormat } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const { t } = useFintI18n()
const { n, d } = useI18nFormat()

const amount = ref(1234567.891)
const moment = new Date(Date.UTC(2026, 7, 4, 9, 30))
</script>

<template>
  <PlaygroundSection
    tone="tinted"
    :eyebrow="t('ui.sections.format.eyebrow')"
    :title="t('ui.sections.format.title')"
    :description="t('ui.sections.format.description')"
  >
    <label class="mt-6 flex flex-col gap-2 text-sm font-medium text-slate-700 max-w-xs">
      {{ t('ui.sections.format.numberLabel') }}
      <input
        v-model.number="amount"
        type="number"
        step="0.001"
        class="px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
      >
    </label>

    <dl class="mt-5 grid gap-3 sm:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <dt class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ t('ui.sections.format.decimalLabel') }}
        </dt>
        <dd class="mt-1 font-mono text-lg text-slate-900">
          {{ n(amount) }}
        </dd>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <dt class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ t('ui.sections.format.currencyLabel') }}
        </dt>
        <dd class="mt-1 font-mono text-lg text-slate-900">
          {{ n(amount, { style: 'currency', currency: 'EUR' }) }}
        </dd>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <dt class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ t('ui.sections.format.percentLabel') }}
        </dt>
        <dd class="mt-1 font-mono text-lg text-slate-900">
          {{ n(0.2564, { style: 'percent', maximumFractionDigits: 1 }) }}
        </dd>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <dt class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ t('ui.sections.format.dateLabel') }}
        </dt>
        <dd class="mt-1 font-mono text-lg text-slate-900">
          {{ d(moment, { dateStyle: 'long', timeZone: 'UTC' }) }}
        </dd>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2">
        <dt class="text-xs font-bold uppercase tracking-wide text-slate-500">
          {{ t('ui.sections.format.dateTimeLabel') }}
        </dt>
        <dd class="mt-1 font-mono text-lg text-slate-900">
          {{ d(moment, { dateStyle: 'full', timeStyle: 'short', timeZone: 'UTC' }) }}
        </dd>
      </div>
    </dl>

    <p class="mt-4 text-xs text-slate-500 leading-5 flex items-center gap-2">
      <span class="i-lucide-zap text-amber-500 w-4 h-4" />
      {{ t('ui.sections.format.cacheHint') }}
    </p>
  </PlaygroundSection>
</template>
