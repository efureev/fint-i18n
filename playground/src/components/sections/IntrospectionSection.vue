<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const i18n = useFintI18n()
const { t, te, locale } = i18n

const probes = ['common.welcome', 'common.menu', 'common.nope', 'common.selfNamed']

const rows = computed(() => probes.map(key => ({
  key,
  exists: te(key),
  translated: t(key),
  // Классическая самодельная проверка — на последней строке она врёт.
  guessed: t(key) !== key,
})))

const known = computed(() => i18n.getKnownLocales().join(', ') || '—')
const available = computed(() => i18n.getAvailableLocales().join(', ') || '—')

const mergedRuntimeLocale = ref(false)
function mergeRuntimeLocale() {
  i18n.mergeMessages('de', 'common', { welcome: 'Willkommen, {name}!' })
  mergedRuntimeLocale.value = true
}
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.introspection.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.introspection.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.introspection.description') }}
      </p>
    </div>

    <div class="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table class="w-full text-left text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-4 py-2 font-semibold">
              {{ t('ui.sections.introspection.keyLabel') }}
            </th>
            <th class="px-4 py-2 font-semibold">
              {{ t('ui.sections.introspection.existsLabel') }}
            </th>
            <th class="px-4 py-2 font-semibold">
              {{ t('ui.sections.introspection.tLabel') }}
            </th>
            <th class="px-4 py-2 font-semibold">
              {{ t('ui.sections.introspection.compareLabel') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-t border-slate-100">
            <td class="px-4 py-2 font-mono text-xs text-slate-800">
              {{ row.key }}
            </td>
            <td class="px-4 py-2 font-mono" :class="row.exists ? 'text-emerald-600' : 'text-slate-400'">
              {{ row.exists }}
            </td>
            <td class="px-4 py-2 text-slate-700 truncate max-w-[16rem]">
              {{ row.translated }}
            </td>
            <td
              class="px-4 py-2 font-mono"
              :class="row.guessed === row.exists ? 'text-slate-400' : 'text-rose-600 font-semibold'"
            >
              {{ row.guessed }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-2 text-xs text-slate-500 leading-5">
      {{ t('ui.sections.introspection.liesHint') }}
    </p>

    <div class="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
      <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
        <span class="i-lucide-languages text-fuchsia-500" />
        {{ t('ui.sections.introspection.localesLabel') }}
      </p>

      <dl class="text-sm">
        <dt class="text-xs text-slate-500">
          {{ t('ui.sections.introspection.knownLabel') }}
        </dt>
        <dd class="font-mono text-slate-800 mb-2">
          {{ known }}
        </dd>

        <dt class="text-xs text-slate-500">
          {{ t('ui.sections.introspection.availableLabel') }}
        </dt>
        <dd class="font-mono text-slate-800">
          {{ available }}
        </dd>
      </dl>

      <button
        type="button"
        class="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
        :disabled="mergedRuntimeLocale"
        @click="mergeRuntimeLocale"
      >
        {{ t('ui.sections.introspection.mergeButton') }}
      </button>

      <p class="mt-2 text-xs text-slate-500 leading-5">
        {{ t('ui.sections.introspection.localesHint') }}
      </p>
    </div>

    <p class="mt-4 text-xs text-slate-500">
      <span class="font-mono">locale = {{ locale }}</span>
    </p>
  </section>
</template>
