<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t, tm, locale } = i18n

// Компонент не знает ни одного пункта меню: он берёт их из словаря целиком.
const menu = computed(() => Object.entries(tm('common.menu') ?? {}))

// Тот же словарь, показанный как исходник, — чтобы связь была видна глазами.
const dictionary = computed(() =>
  JSON.stringify({ menu: tm('common.menu') }, null, 2),
)

const snippet = `const { tm } = useFintI18n()

const menu = computed(() =>
  Object.entries(tm('common.menu') ?? {}),
)`

const boundaries = computed(() => [
  { key: 'common.menu', note: t('ui.sections.subtree.namespaceNote') },
  { key: 'common.welcome', note: t('ui.sections.subtree.leafNote') },
  { key: 'common.files', note: t('ui.sections.subtree.pluralNote') },
  { key: 'common.nope', note: t('ui.sections.subtree.missingNote') },
].map(row => ({
  ...row,
  result: tm(row.key) === undefined ? 'undefined' : `{ ${Object.keys(tm(row.key)!).join(', ')} }`,
})))

const added = ref(false)
function addMenuEntry() {
  const label = locale.value === 'ru' ? 'Помощь' : 'Help'
  i18n.mergeMessages(locale.value, 'common', { menu: { help: label } })
  added.value = true
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.subtree.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.subtree.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.subtree.description') }}
      </p>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-3">
      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-file-json text-amber-500" />
          {{ t('ui.sections.subtree.dictLabel') }}
        </p>
        <pre class="overflow-x-auto text-xs leading-5 text-slate-700 font-mono">{{ dictionary }}</pre>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-code text-indigo-500" />
          {{ t('ui.sections.subtree.codeLabel') }}
        </p>
        <pre class="overflow-x-auto text-xs leading-5 text-slate-700 font-mono">{{ snippet }}</pre>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-layout-list text-emerald-500" />
          {{ t('ui.sections.subtree.resultLabel') }}
        </p>
        <nav class="flex flex-col gap-1">
          <span
            v-for="[key, label] in menu"
            :key="key"
            class="rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-slate-50 border border-slate-100"
          >{{ label }}</span>
        </nav>
      </div>
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-sm text-slate-600 leading-6">
        {{ t('ui.sections.subtree.pointHint') }}
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          :disabled="added"
          @click="addMenuEntry"
        >
          {{ t('ui.sections.subtree.addButton') }}
        </button>
        <span v-if="added" class="text-xs text-emerald-700">
          {{ t('ui.sections.subtree.addedNote') }}
        </span>
      </div>
    </div>

    <div class="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
        {{ t('ui.sections.subtree.boundaryLabel') }}
      </p>
      <dl class="grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,10rem)_minmax(0,1fr)] text-sm">
        <template v-for="row in boundaries" :key="row.key">
          <dt class="font-mono text-xs text-slate-800">
            tm('{{ row.key }}')
          </dt>
          <dd class="font-mono text-xs" :class="row.result === 'undefined' ? 'text-slate-400' : 'text-emerald-600'">
            {{ row.result }}
          </dd>
          <dd class="text-xs text-slate-500">
            {{ row.note }}
          </dd>
        </template>
      </dl>
      <p class="mt-3 text-xs text-slate-500 leading-5">
        {{ t('ui.sections.subtree.readonlyHint') }}
      </p>
    </div>
  </section>
</template>
