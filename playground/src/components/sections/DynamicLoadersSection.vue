<script setup lang="ts">
import { ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const i18n = useFintI18n()
const { t, locale } = i18n

const announceLoaded = ref(false)
const injected = ref(false)

// addLoaders(): register brand-new block loaders after init. `announce` was
// never part of the initial loaders — here we teach the registry about it,
// then load it like any other block.
const addAnnounce = async () => {
  i18n.addLoaders({
    en: { announce: () => import('../../i18n/locales/en/announce.json') },
    ru: { announce: () => import('../../i18n/locales/ru/announce.json') },
  })
  await i18n.loadBlock('announce')
  announceLoaded.value = true
}

// mergeMessages() + markBlockLoaded(): inject messages by hand (no loader) and
// mark the block as loaded — handy for SSR hydration or tests.
const injectRuntime = () => {
  i18n.mergeMessages(locale.value, 'runtime', { hello: t('ui.sections.dynamic.injectedValue') })
  i18n.markBlockLoaded('runtime', locale.value)
  injected.value = true
}

// A failing loader is surfaced through the `onError` hook (see the debug
// panel) instead of crashing — loadUsedBlocks() reports rejections per block.
const triggerError = async () => {
  i18n.addLoaders({
    [locale.value]: { broken: () => Promise.reject(new Error('Simulated loader failure')) },
  })
  i18n.registerUsage('broken')
  try {
    await i18n.loadUsedBlocks(locale.value)
  }
  finally {
    // Unregister so a later locale switch doesn't keep retrying the failure.
    i18n.unregisterUsage('broken')
  }
}
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.dynamic.eyebrow')"
    :title="t('ui.sections.dynamic.title')"
    :description="t('ui.sections.dynamic.description')"
  >
    <div class="mt-6 grid gap-3 md:grid-cols-3">
      <button
        class="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-medium text-teal-800 hover:bg-teal-100/80 transition"
        type="button"
        @click="addAnnounce"
      >
        {{ t('ui.sections.dynamic.addButton') }}
      </button>
      <button
        class="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100/80 transition"
        type="button"
        @click="injectRuntime"
      >
        {{ t('ui.sections.dynamic.injectButton') }}
      </button>
      <button
        class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-800 hover:bg-rose-100/80 transition"
        type="button"
        @click="triggerError"
      >
        {{ t('ui.sections.dynamic.errorButton') }}
      </button>
    </div>

    <div v-if="announceLoaded || injected" class="mt-5 flex flex-col gap-3">
      <div v-if="announceLoaded" class="rounded-2xl border border-teal-200 bg-teal-50 p-4">
        <p class="text-base font-semibold text-teal-900">
          {{ t('announce.banner') }}
        </p>
        <p class="mt-1 text-xs text-teal-700/80">
          {{ t('announce.note') }}
        </p>
      </div>

      <div v-if="injected" class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <p class="text-[11px] font-bold uppercase tracking-wide text-indigo-400 mb-1">
          {{ t('ui.sections.dynamic.injectResultLabel') }}
        </p>
        <p class="text-sm font-medium text-indigo-900">
          {{ t('runtime.hello') }}
        </p>
      </div>
    </div>

    <p class="mt-3 text-xs text-slate-500 flex items-start gap-2">
      <span class="i-lucide-shield-alert mt-0.5 text-rose-400" />
      {{ t('ui.sections.dynamic.errorHint') }}
    </p>
  </PlaygroundSection>
</template>
