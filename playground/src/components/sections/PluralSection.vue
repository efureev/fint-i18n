<script setup lang="ts">
import { computed, ref } from 'vue'
import { getPluralCategories, selectPluralCategory } from '@feugene/fint-i18n/core'
import { useFintI18n, useI18nFormat } from '@feugene/fint-i18n/vue'
import PlaygroundSection from '../PlaygroundSection.vue'

const { t, locale } = useFintI18n()
const { n } = useI18nFormat()

const count = ref(1)

const category = computed(() => selectPluralCategory(locale.value, count.value))
const order = computed(() => getPluralCategories(locale.value))

// Форму выбирает `count`, а подставляется `n`: в `compilePluralForms`
// `params.count` имеет приоритет над `params.n`, поэтому в текст можно отдать
// уже отформатированное число, не сломав выбор ветки.
// Миллион здесь не для красоты: в испанском `many` — единственная категория,
// до которой нельзя дойти маленькими числами, и без него форма из словаря
// осталась бы недостижимой с экрана.
const samples = [0, 1, 2, 5, 11, 21, 101, 1_000_000]
</script>

<template>
  <PlaygroundSection
    tone="tinted"
    :eyebrow="t('ui.sections.plural.eyebrow')"
    :title="t('ui.sections.plural.title')"
    :description="t('ui.sections.plural.description')"
  >
    <div class="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="text-3xl font-semibold text-slate-900">
          {{ t('common.files', { count, n: n(count) }) }}
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="sample in samples"
            :key="sample"
            type="button"
            class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
            :class="count === sample
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'"
            @click="count = sample"
          >
            {{ n(sample) }}
          </button>
        </div>

        <label class="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
          {{ t('ui.sections.plural.counterLabel') }}
          <input v-model.number="count" type="range" min="0" max="120" class="w-full">
        </label>
      </div>

      <div class="flex flex-col gap-3">
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {{ t('ui.sections.plural.categoryLabel') }}
          </p>
          <p class="mt-1 font-mono text-lg font-semibold text-emerald-900">
            {{ category }}
          </p>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-slate-500">
            {{ t('ui.sections.plural.orderLabel') }}
          </p>
          <p class="mt-1 font-mono text-sm text-slate-800">
            {{ order.join(' → ') }}
          </p>
        </div>
      </div>
    </div>

    <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
        <span class="i-lucide-separator-vertical text-fuchsia-500" />
        {{ t('ui.sections.plural.notPluralLabel') }}
      </p>
      <p class="font-mono text-sm text-slate-800">
        {{ t('common.columns') }}
      </p>
      <p class="font-mono text-sm text-slate-800">
        {{ t('common.literalPipe') }}
      </p>
      <p class="mt-2 text-xs text-slate-500 leading-5">
        {{ t('ui.sections.plural.notPluralHint') }}
      </p>
    </div>
  </PlaygroundSection>
</template>
