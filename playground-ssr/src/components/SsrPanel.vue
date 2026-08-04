<script setup lang="ts">
import { inject, onMounted, ref } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'
import { APP_CONTEXT } from '../context'

const { locale } = useFintI18n()
const ctx = inject(APP_CONTEXT)!

// Всё, что известно только после рендера, заполняется после монтирования.
// Отрисуй сервер и клиент это по-разному — Vue сообщил бы о расхождении
// гидрации; здесь же оба выдают «—», а значение появляется следующим тиком.
const clientCalls = ref<string[] | null>(null)
const snapshotBlocks = ref<string>('—')
const payloadBytes = ref<string>('—')

onMounted(() => {
  clientCalls.value = [...ctx.stats.calls]

  const raw = (window as any).__STATE__
  if (!raw) return

  snapshotBlocks.value = Object.entries(raw.i18n.blocks as Record<string, string[]>)
    .map(([loc, names]) => `${loc}: ${names.join(', ')}`)
    .join(' · ') || '—'
  payloadBytes.value = `${JSON.stringify(raw.i18n).length} B`
})
</script>

<template>
  <section class="panel">
    <h2>SSR state</h2>

    <dl class="grid">
      <dt>Locale</dt>
      <dd><code>{{ locale }}</code></dd>

      <dt>Loader calls on the server</dt>
      <dd>{{ ctx.serverCalls.length }} — {{ ctx.serverCalls.join(', ') || '—' }}</dd>

      <dt>Loader calls in the browser</dt>
      <dd>
        <span v-if="clientCalls === null">—</span>
        <span v-else :class="clientCalls.length === 0 ? 'ok' : 'warn'">
          {{ clientCalls.length }} — {{ clientCalls.join(', ') || 'none, the snapshot covered everything' }}
        </span>
      </dd>

      <dt>hydrate() applied</dt>
      <dd :class="ctx.hydrated ? 'ok' : 'warn'">{{ ctx.hydrated ? 'yes' : 'no' }}</dd>

      <dt>Snapshot blocks</dt>
      <dd>{{ snapshotBlocks }}</dd>

      <dt>Snapshot size</dt>
      <dd>{{ payloadBytes }}</dd>
    </dl>

    <p class="hint">
      The snapshot is taken with <code>getSSRState(i18n, { locales: [locale] })</code> and replayed by
      <code>hydrate()</code> before mounting. The blocks arrive marked as loaded, so the browser makes
      no request for them — that is what the browser counter shows.
    </p>

    <p class="hint">
      See it for yourself:
      <a :href="`?locale=${locale}&hydrate=1`">with hydration</a> ·
      <a :href="`?locale=${locale}&hydrate=0`">without it</a>.
      With hydration off the same blocks are fetched again in the browser.
    </p>
  </section>
</template>
