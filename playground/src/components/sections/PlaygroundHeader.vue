<script setup lang="ts">
import { useFintI18n } from '@feugene/fint-i18n/vue'
import LocaleSwitcher from '../LocaleSwitcher.vue'

const { t } = useFintI18n()
</script>

<template>
  <header class="relative overflow-hidden border-b border-slate-200 bg-white px-6 py-7 md:px-8 md:py-9">
    <!--
      Подложка и блик заданы обычным CSS: `presetMini` не отдаёт ни градиентов
      (`bg-gradient-to-*`, `from-*`), ни `blur-*` — они живут в `presetWind`,
      а менять пресет витрины ради шапки значило бы пересобрать всю её утилитную базу.
    -->
    <div
      class="pointer-events-none absolute inset-0"
      style="background: radial-gradient(120% 130% at 0% 0%, #eef2ff 0%, #f6f8fc 45%, #ffffff 80%)"
    />
    <div
      class="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full"
      style="background: radial-gradient(circle, rgba(129, 140, 248, 0.22) 0%, rgba(129, 140, 248, 0) 70%)"
    />

    <div class="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
      <div class="max-w-2xl">
        <p class="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-indigo-600 ring-1 ring-indigo-100 shadow-sm shadow-slate-900/5">
          <span class="i-lucide-sparkles" />
          {{ t('ui.header.eyebrow') }}
        </p>

        <h1 class="mt-4 flex items-center gap-3.5 text-2xl font-bold text-slate-900 md:text-3xl">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
            <span class="i-lucide-languages text-xl" />
          </span>
          {{ t('ui.header.title') }}
        </h1>

        <p class="mt-3.5 text-sm leading-6 text-slate-600 md:text-base md:leading-7">
          {{ t('ui.header.description') }}
        </p>
      </div>

      <div class="flex flex-col gap-2.5 md:items-end">
        <p class="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {{ t('ui.header.localeLabel') }}
        </p>

        <LocaleSwitcher />

        <p class="max-w-xs text-xs leading-5 text-slate-500 md:text-right">
          {{ t('ui.header.toggleHint') }}
        </p>
      </div>
    </div>
  </header>
</template>
