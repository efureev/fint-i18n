<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t } = i18n

const widgetIds = ['alpha', 'beta', 'gamma'] as const
const widgetsLoadedCount = ref(0)

const loadWidgets = async () => {
  // `widgets.*` is expanded once into the registered child blocks
  // (`widgets.alpha`, `widgets.beta`, `widgets.gamma`) and loaded in parallel.
  i18n.registerUsage('widgets.*')
  await i18n.loadBlock('widgets.*')
  widgetsLoadedCount.value = widgetIds.length
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.wildcard.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.wildcard.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.wildcard.description') }}
      </p>
    </div>

    <div class="mt-6 flex flex-col gap-4">
      <button
        data-test="load-widgets"
        class="w-full py-3.5 rounded-2xl border border-sky-200 bg-sky-50 hover:bg-sky-100/80 transition flex items-center justify-center gap-2 font-medium text-sky-800"
        type="button"
        @click="loadWidgets"
      >
        <span class="i-lucide-sparkles text-sky-500" />
        {{ t('ui.sections.wildcard.button') }}
        <span
          v-if="widgetsLoadedCount > 0"
          class="ml-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-sky-700"
        >
          <span class="i-lucide-check-circle-2" />
          {{ t('ui.sections.wildcard.loadedBadge', { count: widgetsLoadedCount }) }}
        </span>
      </button>
      <p class="text-xs text-slate-500 text-center">
        {{ t('ui.sections.wildcard.buttonHint') }}
      </p>

      <div v-if="widgetsLoadedCount > 0" class="grid gap-3 md:grid-cols-3">
        <div
          v-for="id in widgetIds"
          :key="id"
          class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-sky-600 mb-2">
            widgets.{{ id }}
          </p>
          <h3 class="text-sm font-semibold text-slate-900">
            {{ t(`widgets.${id}.title`) }}
          </h3>
          <p class="text-xs text-slate-600 mt-1 leading-5">
            {{ t(`widgets.${id}.description`) }}
          </p>
        </div>
      </div>
    </div>
  </section>
</template>
