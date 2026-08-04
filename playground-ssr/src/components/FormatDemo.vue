<script setup lang="ts">
import { inject } from 'vue'
import { useFintI18n, useI18nFormat } from '@feugene/fint-i18n/vue'
import { APP_CONTEXT } from '../context'

const { t } = useFintI18n()
const { n, d } = useI18nFormat()
const ctx = inject(APP_CONTEXT)!

// Момент времени приходит из полезной нагрузки, а не из `Date.now()`:
// иначе сервер и клиент отформатировали бы разные значения.
const renderedAt = new Date(ctx.renderedAt)

// Часовой пояс задан явно: у сервера и браузера он разный, и без него
// одна и та же дата дала бы разный текст — классическое расхождение гидрации.
const dateOptions = { dateStyle: 'long', timeStyle: 'medium', timeZone: 'UTC' } as const
const money = { style: 'currency', currency: 'EUR' } as const
</script>

<template>
  <section class="panel">
    <h2>Numbers and dates</h2>

    <dl class="grid">
      <dt>{{ t('stats.revenue') }}</dt>
      <dd>{{ n(1234567.891, money) }}</dd>

      <dt>{{ t('stats.share') }}</dt>
      <dd>{{ n(0.2564, { style: 'percent', maximumFractionDigits: 1 }) }}</dd>

      <dt>{{ t('stats.updated') }}</dt>
      <dd>{{ d(renderedAt, dateOptions) }}</dd>

      <dt>{{ t('common.renderedAt', { time: d(renderedAt, { timeStyle: 'medium', timeZone: 'UTC' }) }) }}</dt>
      <dd>—</dd>
    </dl>

    <p class="hint">
      Two rules keep formatting stable across the hydration boundary. The timestamp travels in the
      payload instead of being read from <code>Date.now()</code> on both sides, and every call passes
      an explicit <code>timeZone</code> — the server's zone is not the browser's. Break either one and
      Vue reports a hydration mismatch.
    </p>
  </section>
</template>
