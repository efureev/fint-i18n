<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t, locale } = i18n

const knownLocales = i18n.getKnownLocales()

const isRegistered = ref(false)
const isLoaded = ref(i18n.isBlockLoaded('metrics', locale.value))

const refreshStatus = () => {
  isLoaded.value = i18n.isBlockLoaded('metrics', locale.value)
}

// registerUsage bumps the reference counter; loadUsedBlocks then loads every
// registered-and-used block that isn't loaded yet for the given locale.
const register = () => {
  i18n.registerUsage('metrics')
  isRegistered.value = true
}

const loadUsed = async () => {
  await i18n.loadUsedBlocks(locale.value)
  refreshStatus()
}

// Manual teardown: drop the messages + compiled cache for the block.
const unload = () => {
  i18n.unloadBlock('metrics', locale.value)
  refreshStatus()
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.memory.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.memory.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.memory.description') }}
      </p>
    </div>

    <div class="mt-5 flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold text-slate-500">{{ t('ui.sections.memory.knownLocales') }}:</span>
      <span
        v-for="loc in knownLocales"
        :key="loc"
        class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-mono font-semibold uppercase text-slate-700"
      >
        {{ loc }}
      </span>
    </div>

    <div class="mt-5 grid gap-3 md:grid-cols-3">
      <button
        class="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100/80 transition disabled:opacity-50"
        type="button"
        :disabled="isRegistered"
        @click="register"
      >
        {{ t('ui.sections.memory.register') }}
      </button>
      <button
        class="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-medium text-sky-800 hover:bg-sky-100/80 transition"
        type="button"
        @click="loadUsed"
      >
        {{ t('ui.sections.memory.loadUsed') }}
      </button>
      <button
        class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-800 hover:bg-rose-100/80 transition"
        type="button"
        @click="unload"
      >
        {{ t('ui.sections.memory.unload') }}
      </button>
    </div>

    <div class="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span
        class="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        :class="isLoaded ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'"
      >
        <span :class="isLoaded ? 'i-lucide-check-circle-2' : 'i-lucide-circle-dashed'" />
        {{ isLoaded ? t('ui.sections.memory.statusLoaded') : t('ui.sections.memory.statusNotLoaded') }}
      </span>

      <div v-if="isLoaded" class="rounded-xl border border-slate-200 bg-white p-3">
        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
          {{ t('ui.sections.memory.previewLabel') }}
        </p>
        <p class="text-sm font-semibold text-slate-900">
          {{ t('metrics.title') }}
        </p>
        <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <span>{{ t('metrics.users') }}</span>
          <span>{{ t('metrics.revenue') }}</span>
        </div>
      </div>
    </div>

    <p class="mt-3 text-xs text-slate-500 flex items-start gap-2">
      <span class="i-lucide-lightbulb mt-0.5 text-amber-400" />
      {{ t('ui.sections.memory.autoNote') }}
    </p>
  </section>
</template>
