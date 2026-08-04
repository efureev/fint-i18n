<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t, locale } = i18n

// Состав берётся из `getLoadedBlocks()`, а не из списка в коде: смысл секции
// в том, какие блоки развернул паттерн, и захардкоженный список показывал бы
// ожидание вместо результата.
const loadedWidgets = ref<string[]>([])

const loadWidgets = async () => {
  i18n.registerUsage('widgets.*')
  await i18n.loadBlock('widgets.*')

  loadedWidgets.value = (i18n.getLoadedBlocks()[locale.value] ?? [])
    .filter(block => block.startsWith('widgets.'))
    .sort()
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
          v-if="loadedWidgets.length > 0"
          class="ml-2 inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-sky-700"
        >
          <span class="i-lucide-check-circle-2" />
          {{ t('ui.sections.wildcard.loadedBadge', { count: loadedWidgets.length }) }}
        </span>
      </button>
      <p class="text-xs text-slate-500 text-center">
        {{ t('ui.sections.wildcard.buttonHint') }}
      </p>

      <template v-if="loadedWidgets.length > 0">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
            <span class="i-lucide-list-tree text-sky-500" />
            {{ t('ui.sections.wildcard.expandedLabel') }}
          </p>
          <p class="font-mono text-xs text-slate-800">
            {{ loadedWidgets.join(', ') }}
          </p>
          <p class="mt-2 text-xs text-slate-500 leading-5">
            {{ t('ui.sections.wildcard.expandedHint') }}
          </p>
        </div>

        <div class="grid gap-3 md:grid-cols-3">
          <div
            v-for="block in loadedWidgets"
            :key="block"
            class="rounded-2xl border border-slate-200 bg-slate-50 p-4"
          >
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-sky-600 mb-2">
              {{ block }}
            </p>
            <h3 class="text-sm font-semibold text-slate-900">
              {{ t(`${block}.title`) }}
            </h3>
            <p class="text-xs text-slate-600 mt-1 leading-5">
              {{ t(`${block}.description`) }}
            </p>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>
