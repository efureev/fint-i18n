<script setup lang="ts">
import { useI18nScopeSync } from '@feugene/fint-i18n/vue'

/**
 * Синхронный скоуп, а не `await useI18nScope`: асинхронный setup потребовал бы
 * Suspense, а тот, что выше по дереву, к моменту клика уже разрешён — новая
 * зависимость вернула бы его в pending и мигнула фолбэком на всю страницу.
 *
 * `registerUsage` внутри скоупа держит блок за собой, поэтому `setLocale`
 * догрузит `promo` и на второй локали — счётчик вызовов это покажет.
 */
const { t, locale, ready, error } = useI18nScopeSync('promo', { prefix: true })
</script>

<template>
  <div class="lazy">
    <p v-if="!ready" class="hint">Loading the <code>promo</code> block…</p>

    <p v-else-if="error" class="warn">Failed to load the block: {{ String(error) }}</p>

    <template v-else>
      <h3>{{ t('headline') }}</h3>
      <p>{{ t('lead', { block: 'promo' }) }}</p>
      <p class="hint">{{ t('note') }}</p>
      <p class="hint">{{ t('locale', { locale }) }}</p>
    </template>
  </div>
</template>
