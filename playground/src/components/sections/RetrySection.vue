<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { createFintI18n } from '@feugene/fint-i18n/core'
import type { FintI18n } from '@feugene/fint-i18n/core'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t, locale } = useFintI18n()

const ATTEMPTS = 3
const BACKOFF = (attempt: number) => attempt * 200

interface AttemptEntry {
  attempt: number
  at: number
  ok: boolean
}

const log = ref<AttemptEntry[]>([])
const result = ref<string | null>(null)
const failed = ref(false)
const running = ref(false)

// Демо живёт на собственном инстансе: `retry` задаётся при создании, а
// подменять опцию у общего инстанса витрины значило бы менять её поведение
// ради одной секции.
let demo: FintI18n | null = null

const disposeDemo = () => {
  demo?.dispose()
  demo = null
}

const run = async (failuresBeforeSuccess: number) => {
  disposeDemo()

  log.value = []
  result.value = null
  failed.value = false
  running.value = true

  let attempt = 0
  const startedAt = Date.now()

  demo = createFintI18n({
    locale: locale.value,
    retry: { attempts: ATTEMPTS, backoff: BACKOFF },
    loaders: {
      [locale.value]: {
        flaky: () => {
          attempt++
          const entry: AttemptEntry = { attempt, at: Date.now() - startedAt, ok: attempt > failuresBeforeSuccess }
          log.value = [...log.value, entry]

          return entry.ok
            ? Promise.resolve({ message: t('ui.sections.retry.payload') })
            : Promise.reject(new Error('Simulated loader failure'))
        },
      },
    },
  })

  try {
    await demo.loadBlock('flaky')
    result.value = demo.t('flaky.message')
  }
  catch {
    // Наружу выходит только итоговый отказ — по одному на блок, а не на попытку.
    failed.value = true
  }
  finally {
    running.value = false
  }
}

onUnmounted(disposeDemo)
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
    <div class="max-w-2xl flex flex-col gap-2">
      <p class="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">
        {{ t('ui.sections.retry.eyebrow') }}
      </p>
      <h2 class="text-xl font-semibold text-slate-900">
        {{ t('ui.sections.retry.title') }}
      </h2>
      <p class="text-sm leading-6 text-slate-600">
        {{ t('ui.sections.retry.description') }}
      </p>
    </div>

    <div class="mt-6 flex flex-wrap gap-3">
      <button
        data-test="retry-recovers"
        type="button"
        class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-50"
        :disabled="running"
        @click="run(2)"
      >
        {{ t('ui.sections.retry.recoverButton') }}
      </button>

      <button
        data-test="retry-exhausts"
        type="button"
        class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
        :disabled="running"
        @click="run(ATTEMPTS)"
      >
        {{ t('ui.sections.retry.exhaustButton') }}
      </button>
    </div>

    <div class="mt-5 grid gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-settings-2 text-indigo-500" />
          {{ t('ui.sections.retry.optionLabel') }}
        </p>
        <pre class="overflow-x-auto text-xs leading-5 text-slate-700 font-mono">retry: {
  attempts: {{ ATTEMPTS }},
  backoff: attempt =&gt; attempt * 200,
}</pre>
        <p class="mt-2 text-xs text-slate-500 leading-5">
          {{ t('ui.sections.retry.optionHint') }}
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
          <span class="i-lucide-activity text-rose-500" />
          {{ t('ui.sections.retry.logLabel') }}
        </p>

        <p v-if="log.length === 0" class="text-xs text-slate-400">
          {{ t('ui.sections.retry.logEmpty') }}
        </p>

        <ul v-else class="flex flex-col gap-1 font-mono text-xs" data-test="retry-log">
          <li
            v-for="entry in log"
            :key="entry.attempt"
            :class="entry.ok ? 'text-emerald-700' : 'text-rose-700'"
          >
            {{ t('ui.sections.retry.attemptLine', { attempt: entry.attempt, at: entry.at }) }}
            {{ entry.ok ? t('ui.sections.retry.attemptOk') : t('ui.sections.retry.attemptFailed') }}
          </li>
        </ul>

        <p v-if="result" class="mt-3 text-sm text-emerald-700" data-test="retry-result">
          {{ result }}
        </p>
        <p v-else-if="failed" class="mt-3 text-sm text-rose-700" data-test="retry-failed">
          {{ t('ui.sections.retry.failedNote') }}
        </p>
      </div>
    </div>

    <p class="mt-4 text-xs text-slate-500 leading-5">
      {{ t('ui.sections.retry.disposeHint') }}
    </p>
  </section>
</template>
