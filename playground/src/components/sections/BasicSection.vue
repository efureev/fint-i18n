<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const { t, locale, messages } = useFintI18n()

const name = ref('Senior Developer')
const loadedBlocksCount = computed(() => Object.keys(messages[locale.value] ?? {}).length)
</script>

<template>
  <PlaygroundSection
    tone="tinted"
    :eyebrow="t('ui.sections.basic.eyebrow')"
    :title="t('ui.sections.basic.title')"
    :description="t('ui.sections.basic.description')"
  >
    <template #aside>
      <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
        <span class="i-lucide-box" />
        {{ t('common.blocks', { blocks: loadedBlocksCount }) }}
      </div>
    </template>

    <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
      <div>
        <h3 class="text-2xl font-semibold text-slate-900">
          {{ t('common.welcome', { name }) }}
        </h3>
        <p class="mt-2 text-sm text-slate-600 flex items-center gap-2">
          <span class="i-lucide-info text-blue-500 w-4 h-4" />
          {{ t('common.currentLang', { lang: locale }) }}
        </p>
      </div>

      <label class="flex flex-col gap-2 text-sm font-medium text-slate-700">
        {{ t('ui.sections.basic.inputLabel') }}
        <input
          v-model="name"
          type="text"
          class="px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full"
          :placeholder="t('common.namePlaceholder')"
        >
      </label>
    </div>

    <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
        <span class="i-lucide-braces text-fuchsia-500" />
        {{ t('ui.sections.basic.escapedLabel') }}
      </p>
      <p class="font-mono text-sm text-slate-800 break-words">
        {{ t('common.escaped', { name }) }}
      </p>
      <p class="mt-2 text-xs text-slate-500 leading-5">
        {{ t('ui.sections.basic.escapedHint') }}
      </p>
    </div>
  </PlaygroundSection>
</template>
