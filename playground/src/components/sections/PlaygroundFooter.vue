<script setup lang="ts">
import { computed } from 'vue'
import { useFintI18n } from '@feugene/fint-i18n/vue'

const { t } = useFintI18n()

const REPO = 'https://github.com/efureev/fint-i18n'

// Через локальную константу, а не прямо в шаблоне: `<script setup>` резолвит
// незнакомый идентификатор шаблона в `_ctx.…`, и подстановка `define` до него
// не доходит — версия молча отрендерилась бы пустой.
const version = __FINT_I18N_VERSION__

// Ключи перечислены литералами, а не собраны из `key`: `scripts/check-messages.mjs`
// разбирает вызовы статически, и собранный ключ выпал бы из проверки.
const capabilities = computed(() => [
  { label: t('ui.footer.capabilities.lazy'), icon: 'i-lucide-zap text-yellow-500' },
  { label: t('ui.footer.capabilities.vue'), icon: 'i-lucide-box text-blue-500' },
  { label: t('ui.footer.capabilities.scope'), icon: 'i-lucide-layers-3 text-violet-500' },
  { label: t('ui.footer.capabilities.fallback'), icon: 'i-lucide-git-fork text-emerald-500' },
  { label: t('ui.footer.capabilities.dynamic'), icon: 'i-lucide-plug text-teal-500' },
  { label: t('ui.footer.capabilities.plural'), icon: 'i-lucide-hash text-fuchsia-500' },
  { label: t('ui.footer.capabilities.format'), icon: 'i-lucide-calendar-clock text-orange-500' },
  { label: t('ui.footer.capabilities.introspection'), icon: 'i-lucide-search text-sky-500' },
  { label: t('ui.footer.capabilities.retry'), icon: 'i-lucide-refresh-cw text-rose-500' },
])

const links = computed(() => [
  { label: t('ui.footer.links.docs'), href: `${REPO}/tree/main/docs/en`, icon: 'i-lucide-book-open' },
  { label: t('ui.footer.links.ssr'), href: `${REPO}/tree/main/playground-ssr`, icon: 'i-lucide-server' },
  { label: t('ui.footer.links.tooling'), href: `${REPO}/blob/main/docs/en/tooling.md`, icon: 'i-lucide-terminal' },
])
</script>

<template>
  <footer class="bg-slate-50 border-t border-slate-200 px-6 py-4 md:px-8 flex flex-col gap-3 text-xs text-slate-500">
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <span v-for="item in capabilities" :key="item.label" class="flex items-center gap-1.5">
        <span :class="item.icon" />
        {{ item.label }}
      </span>
    </div>

    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div class="flex flex-wrap gap-x-4 gap-y-2">
        <a
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-1.5 text-slate-600 underline-offset-2 hover:text-indigo-600 hover:underline"
        >
          <span :class="link.icon" />
          {{ link.label }}
        </a>
      </div>

      <span class="font-mono" data-test="package-version">v{{ version }}</span>
    </div>
  </footer>
</template>
