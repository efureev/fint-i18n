<script setup lang="ts">
import { useFintI18n, useI18nScope } from '@feugene/fint-i18n/vue'

await useI18nScope(['auth'])

const { t } = useFintI18n()
</script>

<template>
  <div class="p-5 bg-white rounded-2xl shadow-sm border border-gray-200">
    <div class="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <div class="i-lucide-lock text-blue-500" />
          {{ t('auth.panelTitle') }}
        </h3>
        <p class="text-sm text-gray-500 mt-1">
          {{ t('auth.panelDescription') }}
        </p>
      </div>

      <span class="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
        {{ t('auth.lazyBadge') }}
      </span>
    </div>

    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span class="text-xs text-gray-500 uppercase font-bold tracking-wide">{{ t('auth.username') }}</span>
          <span class="font-medium text-gray-900">{{ t('auth.demoUser') }}</span>
        </div>

        <div class="flex flex-col rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span class="text-xs text-gray-500 uppercase font-bold tracking-wide">{{ t('auth.role') }}</span>
          <span class="font-medium text-gray-900">{{ t('auth.demoRole') }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button class="px-3.5 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition shadow-sm">
          {{ t('auth.login') }}
        </button>
        <button class="px-3.5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
          {{ t('auth.logout') }}
        </button>
      </div>
    </div>

    <p class="mt-4 text-xs text-gray-500">
      {{ t('auth.helper') }}
    </p>
  </div>
</template>
