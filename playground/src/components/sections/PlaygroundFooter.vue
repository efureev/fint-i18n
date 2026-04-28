<script setup lang="ts">
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t } = useFintI18n()
</script>

<template>
  <footer class="bg-slate-50 border-t border-slate-200 px-6 py-4 md:px-8 flex flex-col gap-3 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
    <div class="flex flex-wrap gap-4">
      <span class="flex items-center gap-1.5">
        <span class="i-lucide-zap text-yellow-500" />
        {{ t('ui.footer.lazy') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="i-lucide-box text-blue-500" />
        {{ t('ui.footer.vue') }}
      </span>
      <span class="flex items-center gap-1.5">
        <span class="i-lucide-layers-3 text-violet-500" />
        {{ t('ui.footer.scope') }}
      </span>
    </div>

    <span>v0.1.0</span>
  </footer>
</template>
