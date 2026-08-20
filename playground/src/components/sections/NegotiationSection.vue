<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { createFintI18n, negotiateLocale } from '@feugene/fint-i18n/core'
import type { FintI18n } from '@feugene/fint-i18n/core'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const { t, getAvailableLocales } = useFintI18n()

const available = computed(() => getAvailableLocales())

const browserTags = typeof navigator === 'undefined' ? [] : [...navigator.languages]

const custom = ref(browserTags.join(', ') || 'ru-RU, en-GB')

const requested = computed(() =>
  custom.value.split(',').map(tag => tag.trim()).filter(Boolean),
)

const negotiated = computed(() => negotiateLocale(requested.value, available.value))

// Раскрытие подтега показывается на отдельном инстансе: у общего локаль `ru-RU`
// сменила бы язык всей витрины ради одной секции.
const SUBTAG_LOCALE = 'ru-RU'
const LOADER_LOCALE = 'ru'

let demo: FintI18n | null = null
const storedUnder = ref<string[]>([])
const demoResult = ref<string | null>(null)

const disposeDemo = () => {
  demo?.dispose()
  demo = null
}

const runSubtagDemo = async () => {
  disposeDemo()

  demo = createFintI18n({
    locale: SUBTAG_LOCALE,
    loaders: {
      // Лоадер зарегистрирован только под базовым языком — в этом весь смысл
      // демонстрации. Строка русская намеренно: она доказывает, какой словарь
      // нашёлся, и переводить её вместе с витриной было бы бессмысленно.
      [LOADER_LOCALE]: { demo: () => Promise.resolve({ title: 'Русский словарь' }) },
    },
  })

  await demo.loadBlock('demo')

  storedUnder.value = Object.keys(demo.messages)
  demoResult.value = demo.t('demo.title')
}

onUnmounted(disposeDemo)
</script>

<template>
  <PlaygroundSection
    :eyebrow="t('ui.sections.negotiation.eyebrow')"
    :title="t('ui.sections.negotiation.title')"
    :description="t('ui.sections.negotiation.description')"
  >
    <div class="mt-5 grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
          <span class="i-lucide-languages text-indigo-500" />
          {{ t('ui.sections.negotiation.pickLabel') }}
        </p>

        <label class="block text-xs text-slate-500 mb-1">
          {{ t('ui.sections.negotiation.tagsLabel') }}
        </label>
        <input
          v-model="custom"
          data-test="negotiation-input"
          type="text"
          class="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-700 focus:border-indigo-400 focus:outline-none"
        >
        <p class="mt-1 text-xs text-slate-400">
          {{ t('ui.sections.negotiation.tagsHint') }}
        </p>

        <dl class="mt-4 flex flex-col gap-2 text-xs">
          <div class="flex gap-2">
            <dt class="w-32 shrink-0 text-slate-500">
              {{ t('ui.sections.negotiation.availableLabel') }}
            </dt>
            <dd class="font-mono text-slate-700">
              {{ available.join(', ') }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-32 shrink-0 text-slate-500">
              {{ t('ui.sections.negotiation.resultLabel') }}
            </dt>
            <dd data-test="negotiation-result" class="font-mono">
              <span v-if="negotiated" class="text-emerald-700 font-semibold">{{ negotiated }}</span>
              <span v-else class="text-rose-700">{{ t('ui.sections.negotiation.noMatch') }}</span>
            </dd>
          </div>
        </dl>

        <p class="mt-3 text-xs text-slate-500 leading-5">
          {{ t('ui.sections.negotiation.orderHint') }}
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
          <span class="i-lucide-git-branch text-emerald-500" />
          {{ t('ui.sections.negotiation.subtagLabel') }}
        </p>

        <button
          data-test="negotiation-subtag"
          type="button"
          class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
          @click="runSubtagDemo"
        >
          {{ t('ui.sections.negotiation.subtagButton') }}
        </button>

        <p v-if="demoResult === null" class="mt-3 text-xs text-slate-400">
          {{ t('ui.sections.negotiation.subtagIdle') }}
        </p>

        <dl v-else class="mt-3 flex flex-col gap-2 text-xs" data-test="negotiation-subtag-result">
          <div class="flex gap-2">
            <dt class="w-36 shrink-0 text-slate-500">
              {{ t('ui.sections.negotiation.subtagInstance') }}
            </dt>
            <dd class="font-mono text-slate-700">
              {{ SUBTAG_LOCALE }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-36 shrink-0 text-slate-500">
              {{ t('ui.sections.negotiation.subtagLoader') }}
            </dt>
            <dd class="font-mono text-slate-700">
              {{ LOADER_LOCALE }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-36 shrink-0 text-slate-500">
              {{ t('ui.sections.negotiation.subtagStored') }}
            </dt>
            <dd class="font-mono text-emerald-700 font-semibold">
              {{ storedUnder.join(', ') }}
            </dd>
          </div>
          <div class="flex gap-2">
            <dt class="w-36 shrink-0 text-slate-500">
              t('demo.title')
            </dt>
            <dd class="font-mono text-slate-700">
              {{ demoResult }}
            </dd>
          </div>
        </dl>

        <p class="mt-3 text-xs text-slate-500 leading-5">
          {{ t('ui.sections.negotiation.subtagHint') }}
        </p>
      </div>
    </div>
  </PlaygroundSection>
</template>
