<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const i18n = useFintI18n()
const { t } = i18n

const labLoaded = ref(false)

// The `lab` block is registered in the loaders but not loaded yet, so
// `v-t.preserve="'lab.motto'"` keeps its placeholder text until we load it —
// then the directive updates reactively (it is not `.once`).
const loadLab = async () => {
  await i18n.loadBlock('lab')
  labLoaded.value = true
}
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.directive.eyebrow')"
    :title="t('ui.sections.directive.title')"
    :description="t('ui.sections.directive.description')"
  >
    <div class="mt-6 grid gap-4 md:grid-cols-3">
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

      <div class="rounded-2xl border border-rose-100 bg-rose-50 p-4 flex flex-col">
        <span class="text-xs text-rose-700 font-bold block mb-2 uppercase tracking-wide">{{ t('ui.sections.directive.preserveLabel') }}</span>
        <span v-t.preserve="'lab.motto'" class="text-rose-900 font-medium italic">— lab.motto (not loaded) —</span>
        <p class="text-[11px] text-rose-700/80 mt-2 leading-5">
          {{ t('ui.sections.directive.preserveHint') }}
        </p>
        <button
          v-if="!labLoaded"
          data-test="load-lab"
          class="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-white transition"
          type="button"
          @click="loadLab"
        >
          <span class="i-lucide-download" />
          {{ t('ui.sections.directive.preserveButton') }}
        </button>
      </div>
    </div>
  </PlaygroundSection>
</template>
